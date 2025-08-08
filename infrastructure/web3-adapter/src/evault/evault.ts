import { GraphQLClient } from "graphql-request";
import { v4 } from "uuid";

export interface MetaEnvelope {
    id?: string | null;
    schemaId: string;
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    data: Record<string, any>;
    w3id: string;
}

// Configuration constants
const CONFIG = {
    REQUEST_TIMEOUT: 30000, // 30 seconds
    CONNECTION_TIMEOUT: 10000, // 10 seconds
    TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second base delay
    CONNECTION_POOL_SIZE: 10,
} as const;

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

const FETCH_META_ENVELOPE = `
  query FetchMetaEnvelope($id: ID!) {
    metaEnvelope(id: $id) {
      id
      ontology
      parsed
    }
  }
`;

const UPDATE_META_ENVELOPE = `
  mutation UpdateMetaEnvelopeById($id: String!, $input: MetaEnvelopeInput!) {
    updateMetaEnvelopeById(id: $id, input: $input) {
      metaEnvelope {
        id
        ontology
        parsed
      }
      envelopes {
        id
        ontology
        value
        valueType
      }
    }
  }
`;

interface MetaEnvelopeResponse {
    metaEnvelope: MetaEnvelope;
}

interface StoreMetaEnvelopeResponse {
    storeMetaEnvelope: {
        metaEnvelope: {
            id: string;
            ontology: string;
            envelopes: Array<{
                id: string;
                ontology: string;
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                value: any;
                valueType: string;
            }>;
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            parsed: any;
        };
        envelopes: Array<{
            id: string;
            ontology: string;
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            value: any;
            valueType: string;
        }>;
    };
    updateMetaEnvelopeById: {
        metaEnvelope: {
            id: string;
            ontology: string;
            envelopes: Array<{
                id: string;
                ontology: string;
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                value: any;
                valueType: string;
            }>;
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            parsed: any;
        };
        envelopes: Array<{
            id: string;
            ontology: string;
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            value: any;
            valueType: string;
        }>;
    };
}

interface PlatformTokenResponse {
    token: string;
    expiresAt?: number; // Unix timestamp when token expires
}

interface TokenInfo {
    token: string;
    expiresAt: number;
    obtainedAt: number;
}

export class EVaultClient {
    private client: GraphQLClient | null = null;
    private endpoint: string | null = null;
    private tokenInfo: TokenInfo | null = null;
    private isDisposed = false;

    constructor(
        private registryUrl: string,
        private platform: string,
    ) {}

    /**
     * Cleanup method to properly dispose of resources
     */
    public dispose(): void {
        if (this.isDisposed) return;

        this.isDisposed = true;
        this.client = null;
        this.endpoint = null;
        this.tokenInfo = null;
    }

    /**
     * Retry wrapper with exponential backoff
     */
    private async withRetry<T>(
        operation: () => Promise<T>,
        maxRetries: number = CONFIG.MAX_RETRIES,
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                // Don't retry on the last attempt
                if (attempt === maxRetries) break;

                // Don't retry on certain errors
                if (error instanceof Error) {
                    const isRetryable = !(
                        error.message.includes("401") ||
                        error.message.includes("403") ||
                        error.message.includes("404")
                    );

                    if (!isRetryable) break;
                }

                // Exponential backoff
                const delay = CONFIG.RETRY_DELAY * 2 ** attempt;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        throw lastError!;
    }

    /**
     * Requests a platform token from the registry
     * @returns Promise<string> - The platform token
     */
    private async requestPlatformToken(): Promise<TokenInfo> {
        try {
            const response = await fetch(
                new URL(
                    "/platforms/certification",
                    this.registryUrl,
                ).toString(),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ platform: this.platform }),
                },
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = (await response.json()) as PlatformTokenResponse;
            const now = Date.now();
            const expiresAt = data.expiresAt || now + 3600000; // Default 1 hour

            return {
                token: data.token,
                expiresAt,
                obtainedAt: now,
            };
        } catch (error) {
            console.error("Error requesting platform token:", error);
            throw new Error("Failed to request platform token");
        }
    }

    /**
     * Checks if token needs refresh
     */
    private isTokenExpired(): boolean {
        if (!this.tokenInfo) return true;

        const now = Date.now();
        const timeUntilExpiry = this.tokenInfo.expiresAt - now;

        return timeUntilExpiry <= CONFIG.TOKEN_REFRESH_THRESHOLD;
    }

    /**
     * Ensures we have a valid platform token, requesting one if needed
     * @returns Promise<string> - The platform token
     */
    private async ensurePlatformToken(): Promise<string> {
        if (!this.tokenInfo || this.isTokenExpired()) {
            this.tokenInfo = await this.requestPlatformToken();
        }
        return this.tokenInfo.token;
    }

    private async resolveEndpoint(w3id: string): Promise<string> {
        try {
            const response = await fetch(
                new URL(`/resolve?w3id=${w3id}`, this.registryUrl).toString(),
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return new URL("/graphql", data.uri).toString();
        } catch (error) {
            console.error("Error resolving eVault endpoint:", error);
            throw new Error("Failed to resolve eVault endpoint");
        }
    }

    private async ensureClient(w3id: string): Promise<GraphQLClient> {
        if (this.isDisposed) {
            throw new Error("EVaultClient has been disposed");
        }

        if (!this.endpoint || !this.client) {
            this.endpoint = await this.resolveEndpoint(w3id).catch(() => null);
            if (!this.endpoint) throw new Error("Failed to resolve endpoint");

            // Get platform token and create client with authorization header
            const token = await this.ensurePlatformToken();
            this.client = new GraphQLClient(this.endpoint, {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            });
        }
        return this.client;
    }

    async storeMetaEnvelope(envelope: MetaEnvelope): Promise<string> {
        return this.withRetry(async () => {
            const client = await this.ensureClient(envelope.w3id).catch(() => {
                return null;
            });
            if (!client) return v4();

            console.log("sending payload", envelope);

            const response = await client
                .request<StoreMetaEnvelopeResponse>(STORE_META_ENVELOPE, {
                    input: {
                        ontology: envelope.schemaId,
                        payload: envelope.data,
                        acl: ["*"],
                    },
                })
                .catch(() => null);

            if (!response) return v4();
            return response.storeMetaEnvelope.metaEnvelope.id;
        });
    }

    async storeReference(referenceId: string, w3id: string): Promise<void> {
        return this.withRetry(async () => {
            const client = await this.ensureClient(w3id);

            const response = await client
                .request<StoreMetaEnvelopeResponse>(STORE_META_ENVELOPE, {
                    input: {
                        ontology: "reference",
                        payload: {
                            _by_reference: referenceId,
                        },
                        acl: ["*"],
                    },
                })
                .catch(() => null);

            if (!response) {
                console.error("Failed to store reference");
                throw new Error("Failed to store reference");
            }
        });
    }

    async fetchMetaEnvelope(id: string, w3id: string): Promise<MetaEnvelope> {
        return this.withRetry(async () => {
            const client = await this.ensureClient(w3id);

            try {
                const response = await client.request<MetaEnvelopeResponse>(
                    FETCH_META_ENVELOPE,
                    {
                        id,
                        w3id,
                    },
                );
                return response.metaEnvelope;
            } catch (error) {
                console.error("Error fetching meta envelope:", error);
                throw error;
            }
        });
    }

    async updateMetaEnvelopeById(
        id: string,
        envelope: MetaEnvelope,
    ): Promise<void> {
        return this.withRetry(async () => {
            console.log("sending to eVault", envelope.w3id);
            const client = await this.ensureClient(envelope.w3id).catch(
                () => null,
            );
            if (!client)
                throw new Error("Failed to establish client connection");

            try {
                const variables = {
                    id,
                    input: {
                        ontology: envelope.schemaId,
                        payload: envelope.data,
                        acl: ["*"],
                    },
                };

                const response =
                    await client.request<StoreMetaEnvelopeResponse>(
                        UPDATE_META_ENVELOPE,
                        variables,
                    );
            } catch (error) {
                console.error("Error updating meta envelope:", error);
                throw error;
            }
        });
    }
}
