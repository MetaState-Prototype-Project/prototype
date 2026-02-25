import {
    PUBLIC_EID_WALLET_TOKEN,
    PUBLIC_PROVISIONER_URL,
    PUBLIC_REGISTRY_URL,
} from "$env/static/public";
import type { Store } from "@tauri-apps/plugin-store";
import axios from "axios";
import { GraphQLClient } from "graphql-request";
import { syncPublicKeyToEvault } from "wallet-sdk";
import NotificationService from "../../services/NotificationService";
import type { KeyService } from "./key";
import type { UserController } from "./user";

const USER_PROFILE_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

const FIND_USER_PROFILE = `
  query FindUserProfile($ontologyId: ID!) {
    metaEnvelopes(filter: { ontologyId: $ontologyId }, first: 1) {
      edges {
        node {
          id
          ontology
          parsed
        }
      }
    }
  }
`;

const CREATE_META_ENVELOPE = `
  mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
    createMetaEnvelope(input: $input) {
      metaEnvelope {
        id
        ontology
        parsed
      }
      errors {
        message
        code
      }
    }
  }
`;

const UPDATE_META_ENVELOPE = `
  mutation UpdateMetaEnvelope($id: ID!, $input: MetaEnvelopeInput!) {
    updateMetaEnvelope(id: $id, input: $input) {
      metaEnvelope {
        id
        ontology
        parsed
      }
      errors {
        message
        code
      }
    }
  }
`;

interface GraphQLErrorItem {
    message: string;
    code?: string;
}

interface ExistingUserProfileEnvelope {
    id: string;
    ontology: string;
    parsed?: Partial<UserProfile>;
}

interface FindUserProfileResponse {
    metaEnvelopes: {
        edges: Array<{
            node: ExistingUserProfileEnvelope;
        }>;
    };
}

interface CreateMetaEnvelopeResponse {
    createMetaEnvelope: {
        metaEnvelope: {
            id: string;
            ontology: string;
            parsed: UserProfile;
        } | null;
        errors: GraphQLErrorItem[] | null;
    };
}

interface UpdateMetaEnvelopeResponse {
    updateMetaEnvelope: {
        metaEnvelope: {
            id: string;
            ontology: string;
            parsed: UserProfile;
        } | null;
        errors: GraphQLErrorItem[] | null;
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
    #walletSdkAdapter: import("wallet-sdk").CryptoAdapter | null = null;
    #profileCreationStatus: "idle" | "loading" | "success" | "failed" = "idle";
    #notificationService: NotificationService;

    constructor(
        store: Store,
        userController: UserController,
        keyService?: KeyService,
        walletSdkAdapter?: import("wallet-sdk").CryptoAdapter,
    ) {
        this.#store = store;
        this.#userController = userController;
        this.#keyService = keyService || null;
        this.#walletSdkAdapter = walletSdkAdapter ?? null;
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
     * Sync public key to eVault core via wallet-sdk.
     * SDK checks /whois and skips PATCH if current key already in certs; otherwise PATCHes /public-key.
     */
    async syncPublicKey(eName: string): Promise<void> {
        if (!this.#walletSdkAdapter) {
            console.warn(
                "Wallet SDK adapter not available, cannot sync public key",
            );
            return;
        }
        const vault = await this.vault;
        if (!vault?.uri) {
            console.warn("No vault URI available, cannot sync public key");
            return;
        }
        try {
            await syncPublicKeyToEvault(this.#walletSdkAdapter, {
                evaultUri: vault.uri,
                eName,
                keyId: "default",
                context: "onboarding",
                authToken: PUBLIC_EID_WALLET_TOKEN || null,
                registryUrl: PUBLIC_REGISTRY_URL,
            });
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

            await this.upsertUserProfileInEVault(
                vault.ename,
                displayName,
                vault.ename,
            );

            this.profileCreationStatus = "success";
        } catch (error) {
            console.error(
                "Failed to upsert UserProfile in eVault (retry):",
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
                ...(PUBLIC_EID_WALLET_TOKEN
                    ? { Authorization: `Bearer ${PUBLIC_EID_WALLET_TOKEN}` }
                    : {}),
            },
        });
        return this.#client;
    }

    private buildUserProfilePayload(
        ename: string,
        displayName: string,
        now: string,
        existingProfile?: Partial<UserProfile>,
    ): UserProfile {
        const username = ename.replace("@", "");
        return {
            username: existingProfile?.username ?? username,
            displayName,
            bio: existingProfile?.bio ?? null,
            avatarUrl: existingProfile?.avatarUrl ?? null,
            bannerUrl: existingProfile?.bannerUrl ?? null,
            ename: existingProfile?.ename ?? ename,
            isVerified: existingProfile?.isVerified ?? false,
            isPrivate: existingProfile?.isPrivate ?? false,
            createdAt: existingProfile?.createdAt ?? now,
            updatedAt: now,
            isArchived: existingProfile?.isArchived ?? false,
        };
    }

    private async findExistingUserProfile(
        client: GraphQLClient,
    ): Promise<ExistingUserProfileEnvelope | undefined> {
        const response = await client.request<FindUserProfileResponse>(
            FIND_USER_PROFILE,
            {
                ontologyId: USER_PROFILE_ONTOLOGY,
            },
        );
        return response.metaEnvelopes.edges[0]?.node;
    }

    private throwIfGraphQLErrors(
        errors: GraphQLErrorItem[] | null | undefined,
        operation: "create" | "update",
    ) {
        if (!errors?.length) return;
        const message = errors[0]?.message ?? "Unknown GraphQL error";
        throw new Error(`[UserProfile ${operation}] ${message}`);
    }

    /**
     * Upsert UserProfile in eVault with retry mechanism.
     * Lookup is performed on each attempt to avoid creating duplicates.
     */
    private async upsertUserProfileInEVault(
        ename: string,
        displayName: string,
        w3id: string,
        maxRetries = 10,
    ): Promise<void> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const now = new Date().toISOString();
                const client = await this.ensureClient(w3id, ename);
                const existingProfile =
                    await this.findExistingUserProfile(client);
                const payload = this.buildUserProfilePayload(
                    ename,
                    displayName,
                    now,
                    existingProfile?.parsed,
                );

                if (existingProfile?.id) {
                    console.log(
                        `Attempting to update existing UserProfile in eVault (attempt ${attempt}/${maxRetries})`,
                    );
                    const response =
                        await client.request<UpdateMetaEnvelopeResponse>(
                            UPDATE_META_ENVELOPE,
                            {
                                id: existingProfile.id,
                                input: {
                                    ontology: USER_PROFILE_ONTOLOGY,
                                    payload,
                                    acl: ["*"],
                                },
                            },
                        );
                    this.throwIfGraphQLErrors(
                        response.updateMetaEnvelope.errors,
                        "update",
                    );
                    console.log(
                        "UserProfile updated successfully in eVault:",
                        response.updateMetaEnvelope.metaEnvelope?.id ??
                            existingProfile.id,
                    );
                    return;
                }

                console.log(
                    `Attempting to create UserProfile in eVault (attempt ${attempt}/${maxRetries})`,
                );
                const response =
                    await client.request<CreateMetaEnvelopeResponse>(
                        CREATE_META_ENVELOPE,
                        {
                            input: {
                                ontology: USER_PROFILE_ONTOLOGY,
                                payload,
                                acl: ["*"],
                            },
                        },
                    );
                this.throwIfGraphQLErrors(
                    response.createMetaEnvelope.errors,
                    "create",
                );
                console.log(
                    "UserProfile created successfully in eVault:",
                    response.createMetaEnvelope.metaEnvelope?.id ??
                        "unknown-id",
                );
                return;
            } catch (error) {
                console.error(
                    `Failed to upsert UserProfile in eVault (attempt ${attempt}/${maxRetries}):`,
                    error,
                );

                if (attempt === maxRetries) {
                    console.error(
                        "Max retries reached, giving up on UserProfile upsert",
                    );
                    throw error;
                }

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
                            await this.upsertUserProfileInEVault(
                                resolvedUser?.ename as string,
                                displayName as string,
                                resolvedUser?.ename as string,
                            );
                            this.profileCreationStatus = "success";
                        } catch (error) {
                            console.error(
                                "Failed to upsert UserProfile in eVault:",
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

            // Get user data for display name and upsert UserProfile
            (async () => {
                try {
                    const userData = await this.#userController.user;
                    const displayName = userData?.name || vault.ename;

                    await this.upsertUserProfileInEVault(
                        vault.ename,
                        displayName,
                        vault.ename,
                    );
                    this.profileCreationStatus = "success";
                } catch (error) {
                    console.error(
                        "Failed to get user data or upsert UserProfile:",
                        error,
                    );
                    // Fallback to using ename as display name
                    try {
                        await this.upsertUserProfileInEVault(
                            vault.ename,
                            vault.ename,
                            vault.ename,
                        );
                        this.profileCreationStatus = "success";
                    } catch (fallbackError) {
                        console.error(
                            "Failed to upsert UserProfile in eVault (fallback):",
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

    /**
     * Resolve the Fastify (non-GraphQL) base URL for this vault.
     * The GraphQL endpoint lives at `<base>/graphql`; other HTTP routes sit at `<base>`.
     */
    private async resolveBaseUrl(w3id: string): Promise<string> {
        const graphqlUrl = await this.resolveEndpoint(w3id);
        return graphqlUrl.replace(/\/graphql$/, "");
    }

    /**
     * Store the recovery passphrase for this vault on the eVault server.
     * Only a PBKDF2 hash is persisted on the server; the plain text is never sent
     * across the wire in any readable form — it is sent over HTTPS and immediately
     * hashed server-side with a random salt.
     *
     * @throws if the passphrase does not meet strength requirements (validated server-side)
     * @throws if no vault is found
     */
    async setRecoveryPassphrase(
        passphrase: string,
        confirmPassphrase: string,
    ): Promise<void> {
        if (passphrase !== confirmPassphrase) {
            throw new Error("Passphrases do not match");
        }

        const vault = await this.vault;
        if (!vault?.ename) {
            throw new Error("No vault available");
        }

        const base = await this.resolveBaseUrl(vault.ename);

        // Retrieve a valid auth token by re-using the token used for other vault ops
        const token = PUBLIC_EID_WALLET_TOKEN || null;

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-ENAME": vault.ename,
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await axios.post(
            new URL("/passphrase/set", base).toString(),
            { passphrase },
            { headers },
        );

        if (!response.data?.success) {
            throw new Error(
                response.data?.error ?? "Failed to store recovery passphrase",
            );
        }
    }

    /**
     * Check whether a recovery passphrase has been set on the eVault.
     */
    async hasRecoveryPassphrase(): Promise<boolean> {
        const vault = await this.vault;
        if (!vault?.ename) return false;

        try {
            const base = await this.resolveBaseUrl(vault.ename);
            const token = PUBLIC_EID_WALLET_TOKEN || null;
            const headers: Record<string, string> = { "X-ENAME": vault.ename };
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await axios.get(
                new URL("/passphrase/status", base).toString(),
                { headers },
            );
            return response.data?.hasPassphrase === true;
        } catch {
            return false;
        }
    }

    async clear() {
        await this.#store.delete("vault");
    }
}
