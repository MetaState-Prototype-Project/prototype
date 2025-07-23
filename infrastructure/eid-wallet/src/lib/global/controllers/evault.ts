import { PUBLIC_REGISTRY_URL } from "$env/static/public";
import type { Store } from "@tauri-apps/plugin-store";
import axios from "axios";
import { GraphQLClient } from "graphql-request";
import type { UserController } from "./user";

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
    #profileCreationStatus: "idle" | "loading" | "success" | "failed" = "idle";

    constructor(store: Store, userController: UserController) {
        this.#store = store;
        this.#userController = userController;
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
     * Resolve eVault endpoint from registry
     */
    private async resolveEndpoint(w3id: string): Promise<string> {
        try {
            const response = await axios.get(
                new URL(`resolve?w3id=${w3id}`, PUBLIC_REGISTRY_URL).toString(),
            );
            return new URL("/graphql", response.data.uri).toString();
        } catch (error) {
            console.error("Error resolving eVault endpoint:", error);
            throw new Error("Failed to resolve eVault endpoint");
        }
    }

    /**
     * Ensure we have a valid GraphQL client
     */
    private async ensureClient(w3id: string): Promise<GraphQLClient> {
        if (!this.#endpoint || !this.#client) {
            this.#endpoint = await this.resolveEndpoint(w3id);
            this.#client = new GraphQLClient(this.#endpoint);
        }
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
                const client = await this.ensureClient(w3id);

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
                        // Set loading status
                        this.profileCreationStatus = "loading";
                        // Get user data for display name
                        const userData = await this.#userController.user;
                        const displayName =
                            userData?.name || resolvedUser?.ename;

                        try {
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
}
