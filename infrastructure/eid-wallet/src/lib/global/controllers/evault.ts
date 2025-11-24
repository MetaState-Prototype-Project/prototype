import {
    PUBLIC_REGISTRY_URL,
    PUBLIC_PROVISIONER_URL,
    PUBLIC_EID_WALLET_TOKEN,
} from "$env/static/public";
import type { Store } from "@tauri-apps/plugin-store";
import axios from "axios";
import { GraphQLClient } from "graphql-request";
import NotificationService from "../../services/NotificationService";
import type { UserController } from "./user";
import type { KeyService } from "./key";

const STORE_META_ENVELOPE = `
  mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
    storeMetaEnvelope(input: $input) {
      metaEnvelope {
        id
        ontology
        parsed
      }
    }
  }
`;

interface MetaEnvelopeResponse {
    storeMetaEnvelope: {
        metaEnvelope: {
            id: string;
            ontology: string;
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            parsed: any;
        };
    };
}

interface UserProfile {
    username: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    ename: string;
    isVerified: boolean;
    isPrivate: boolean;
    createdAt: string;
    updatedAt: string;
    isArchived: boolean;
}

export class VaultController {
    #store: Store;
    #client: GraphQLClient | null = null;
    #endpoint: string | null = null;
    #userController: UserController;
    #keyService: KeyService | null = null;
    #profileCreationStatus: "idle" | "loading" | "success" | "failed" = "idle";
    #notificationService: NotificationService;

    constructor(
        store: Store,
        userController: UserController,
        keyService?: KeyService,
    ) {
        this.#store = store;
        this.#userController = userController;
        this.#keyService = keyService || null;
        this.#notificationService = NotificationService.getInstance();
    }

    /**
     * Get the current profile creation status
     */
    get profileCreationStatus() {
        return this.#profileCreationStatus;
    }

    /**
     * Set the profile creation status
     */
    set profileCreationStatus(status:
        | "idle"
        | "loading"
        | "success"
        | "failed") {
        this.#profileCreationStatus = status;
    }

    /**
     * Sync public key to eVault core
     * Checks if public key was already saved, calls /whois, and PATCH if needed
     */
    async syncPublicKey(eName: string): Promise<void> {
        try {
            // Check if we've already saved the public key
            const savedKey = localStorage.getItem(`publicKeySaved_${eName}`);
            if (savedKey === "true") {
                console.log(
                    `Public key already saved for ${eName}, skipping sync`,
                );
                return;
            }

            if (!this.#keyService) {
                console.warn(
                    "KeyService not available, cannot sync public key",
                );
                return;
            }

            // Get the eVault URI
            const vault = await this.vault;
            if (!vault?.uri) {
                console.warn("No vault URI available, cannot sync public key");
                return;
            }

            // Call /whois to check if public key exists
            const whoisUrl = new URL("/whois", vault.uri).toString();
            const whoisResponse = await axios.get(whoisUrl, {
                headers: {
                    "X-ENAME": eName,
                },
            });

            const existingPublicKey = whoisResponse.data?.publicKey;
            if (existingPublicKey) {
                // Public key already exists, mark as saved
                localStorage.setItem(`publicKeySaved_${eName}`, "true");
                console.log(`Public key already exists for ${eName}`);
                return;
            }

            // Get public key using the exact same logic as onboarding/verification flow
            // KEY_ID is always "default", context depends on whether user is pre-verification
            const KEY_ID = "default";

            // Determine context: check if user is pre-verification (fake/demo user)
            const isFake = await this.#userController.isFake;
            const context = isFake ? "pre-verification" : "onboarding";

            // Get public key using the same method as getApplicationPublicKey() in onboarding/verify
            let publicKey: string | undefined;
            try {
                publicKey = await this.#keyService.getPublicKey(
                    KEY_ID,
                    context,
                );
            } catch (error) {
                console.error(
                    `Failed to get public key for ${KEY_ID} with context ${context}:`,
                    error,
                );
                return;
            }

            if (!publicKey) {
                console.warn(
                    `No public key found for ${KEY_ID} with context ${context}, cannot sync`,
                );
                return;
            }

            // Get authentication token from environment variable
            const authToken = PUBLIC_EID_WALLET_TOKEN || null;
            if (!authToken) {
                console.warn(
                    "PUBLIC_EID_WALLET_TOKEN not set, request may fail authentication",
                );
            }

            // Call PATCH /public-key to save the public key
            const patchUrl = new URL("/public-key", vault.uri).toString();
            const headers: Record<string, string> = {
                "X-ENAME": eName,
                "Content-Type": "application/json",
            };

            if (authToken) {
                headers["Authorization"] = `Bearer ${authToken}`;
            }

            await axios.patch(patchUrl, { publicKey }, { headers });

            // Mark as saved
            localStorage.setItem(`publicKeySaved_${eName}`, "true");
            console.log(`Public key synced successfully for ${eName}`);
        } catch (error) {
            console.error("Failed to sync public key:", error);
            // Don't throw - this is a non-critical operation
        }
    }

    /**
     * Register device for notifications
     */
    private async registerDeviceForNotifications(eName: string): Promise<void> {
        try {
            console.log(
                `Registering device for notifications with eName: ${eName}`,
            );
            const success =
                await this.#notificationService.registerDevice(eName);
            if (success) {
                console.log("Device registered successfully for notifications");
            } else {
                console.warn("Failed to register device for notifications");
            }
        } catch (error) {
            console.error("Error registering device for notifications:", error);
            // Don't throw error - device registration failure shouldn't break vault setup
        }
    }

    /**
     * Retry profile creation
     */
    async retryProfileCreation(): Promise<void> {
        const vault = await this.vault;
        if (!vault?.ename) {
            throw new Error("No vault data available for profile creation");
        }

        this.profileCreationStatus = "loading";

        try {
            const userData = await this.#userController.user;
            const displayName = userData?.name || vault.ename;

            await this.createUserProfileInEVault(
                vault.ename,
                displayName,
                vault.ename,
            );

            this.profileCreationStatus = "success";
        } catch (error) {
            console.error(
                "Failed to create UserProfile in eVault (retry):",
                error,
            );
            this.profileCreationStatus = "failed";
            throw error;
        }
    }

    /**
     * Simple health check: just checks if registry can resolve the w3id
     * Returns the URI if healthy, throws error if not
     */
    async checkHealth(w3id: string): Promise<{
        healthy: boolean;
        deleted?: boolean;
        uri?: string;
        error?: string;
    }> {
        try {
            console.log(`🏥 Checking eVault health for ${w3id}...`);
            const response = await axios.get(
                new URL(`resolve?w3id=${w3id}`, PUBLIC_REGISTRY_URL).toString(),
                {
                    timeout: 3000, // 3 second timeout
                },
            );

            if (response.data?.uri) {
                console.log(`✅ eVault is healthy, URI: ${response.data.uri}`);
                return { healthy: true, uri: response.data.uri };
            }
            console.warn("⚠️ Registry responded but no URI found");
            return { healthy: false, error: "No URI in registry response" };
        } catch (error) {
            // Check if it's a 404 - eVault has been deleted
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                console.error(
                    "🗑️ eVault not found in registry (404) - it has been deleted",
                );
                return {
                    healthy: false,
                    deleted: true,
                    error: "eVault has been deleted from registry",
                };
            }

            const errorMessage =
                error instanceof Error ? error.message : String(error);
            console.error(`❌ eVault health check failed: ${errorMessage}`);
            return { healthy: false, error: errorMessage };
        }
    }

    /**
     * Resolve eVault endpoint from registry with retry logic
     */
    private async resolveEndpoint(w3id: string): Promise<string> {
        const maxRetries = 5;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                const response = await axios.get(
                    new URL(
                        `resolve?w3id=${w3id}`,
                        PUBLIC_REGISTRY_URL,
                    ).toString(),
                    {
                        timeout: 5000, // 5 second timeout for resolve
                    },
                );
                return new URL("/graphql", response.data.uri).toString();
            } catch (error) {
                retryCount++;
                console.error(
                    `Error resolving eVault endpoint (attempt ${retryCount}/${maxRetries}):`,
                    error,
                );

                if (retryCount >= maxRetries) {
                    throw new Error(
                        "Failed to resolve eVault endpoint after all retries",
                    );
                }

                // Wait before retrying (exponential backoff)
                const delay = Math.min(1000 * 2 ** (retryCount - 1), 10000);
                console.log(`Waiting ${delay}ms before resolve retry...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        throw new Error("Failed to resolve eVault endpoint");
    }

    /**
     * Create a new GraphQL client every time
     */
    private async ensureClient(
        w3id: string,
        ename: string,
    ): Promise<GraphQLClient> {
        this.#endpoint = await this.resolveEndpoint(w3id);
        this.#client = new GraphQLClient(this.#endpoint, {
            headers: {
                "X-ENAME": ename,
            },
        });
        return this.#client;
    }

    /**
     * Create UserProfile in eVault with retry mechanism
     */
    private async createUserProfileInEVault(
        ename: string,
        displayName: string,
        w3id: string,
        maxRetries = 10,
    ): Promise<void> {
        console.log("attempting");
        const username = ename.replace("@", "");
        const now = new Date().toISOString();

        const userProfile: UserProfile = {
            username,
            displayName,
            bio: null,
            avatarUrl: null,
            bannerUrl: null,
            ename,
            isVerified: false,
            isPrivate: false,
            createdAt: now,
            updatedAt: now,
            isArchived: false,
        };

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const client = await this.ensureClient(w3id, ename);

                console.log(
                    `Attempting to create UserProfile in eVault (attempt ${attempt}/${maxRetries})`,
                );

                const response = await client.request<MetaEnvelopeResponse>(
                    STORE_META_ENVELOPE,
                    {
                        input: {
                            ontology: "550e8400-e29b-41d4-a716-446655440000",
                            payload: userProfile,
                            acl: ["*"],
                        },
                    },
                );

                console.log(
                    "UserProfile created successfully in eVault:",
                    response.storeMetaEnvelope.metaEnvelope.id,
                );
                return;
            } catch (error) {
                console.error(
                    `Failed to create UserProfile in eVault (attempt ${attempt}/${maxRetries}):`,
                    error,
                );

                if (attempt === maxRetries) {
                    console.error(
                        "Max retries reached, giving up on UserProfile creation",
                    );
                    throw error;
                }

                // Wait before retrying (exponential backoff)
                const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    set vault(vault:
        | Promise<Record<string, string> | undefined>
        | Record<string, string>
        | undefined) {
        if (vault instanceof Promise)
            vault
                .then(async (resolvedUser) => {
                    if (resolvedUser?.ename) {
                        this.#store.set("vault", resolvedUser);

                        // Register device for notifications
                        await this.registerDeviceForNotifications(
                            resolvedUser.ename,
                        );

                        // Set loading status
                        // Get user data for display name
                        const userData = await this.#userController.user;
                        const displayName =
                            userData?.name || resolvedUser?.ename;

                        try {
                            if (this.profileCreationStatus === "success")
                                return;
                            this.profileCreationStatus = "loading";
                            await this.createUserProfileInEVault(
                                resolvedUser?.ename as string,
                                displayName as string,
                                resolvedUser?.ename as string,
                            );
                            this.profileCreationStatus = "success";
                        } catch (error) {
                            console.error(
                                "Failed to create UserProfile in eVault:",
                                error,
                            );
                            this.profileCreationStatus = "failed";
                        }
                    }
                })
                .catch((error) => {
                    console.error("Failed to set vault:", error);
                    this.profileCreationStatus = "failed";
                });
        else if (vault?.ename) {
            this.#store.set("vault", vault);

            // Register device for notifications
            this.registerDeviceForNotifications(vault.ename);

            // Sync public key to eVault core
            this.syncPublicKey(vault.ename);

            if (this.profileCreationStatus === "success") return;
            // Set loading status
            this.profileCreationStatus = "loading";

            // Get user data for display name and create UserProfile
            (async () => {
                try {
                    const userData = await this.#userController.user;
                    const displayName = userData?.name || vault.ename;

                    await this.createUserProfileInEVault(
                        vault.ename,
                        displayName,
                        vault.ename,
                    );
                    this.profileCreationStatus = "success";
                } catch (error) {
                    console.error(
                        "Failed to get user data or create UserProfile:",
                        error,
                    );
                    // Fallback to using ename as display name
                    try {
                        await this.createUserProfileInEVault(
                            vault.ename,
                            vault.ename,
                            vault.ename,
                        );
                        this.profileCreationStatus = "success";
                    } catch (fallbackError) {
                        console.error(
                            "Failed to create UserProfile in eVault (fallback):",
                            fallbackError,
                        );
                        this.profileCreationStatus = "failed";
                    }
                }
            })();
        }
    }

    get vault() {
        return this.#store
            .get<Record<string, string>>("vault")
            .then((vault) => {
                if (!vault) {
                    return undefined;
                }
                return vault;
            })
            .catch((error) => {
                console.error("Failed to get vault:", error);
                return undefined;
            });
    }

    // Getters for internal properties
    getclient() {
        return this.#client;
    }

    getendpoint() {
        return this.#endpoint;
    }

    async clear() {
        await this.#store.delete("vault");
    }
}
