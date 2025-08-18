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
    HEALTH_CHECK_TIMEOUT: 5000, // 5 seconds for health check
    MAX_HEALTH_CHECK_FAILURES: 3, // Max consecutive failures before re-resolution
    GRAPHQL_TIMEOUT: 10000, // 10 seconds for GraphQL requests before considering endpoint unhealthy
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
    private clients: Map<string, GraphQLClient> = new Map();
    private endpoints: Map<string, string> = new Map();
    private tokenInfo: TokenInfo | null = null;
    private isDisposed = false;
    
    // Health check tracking
    private healthCheckFailures: Map<string, number> = new Map();
    private lastHealthCheck: Map<string, number> = new Map();

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
        this.clients.clear();
        this.endpoints.clear();
        this.healthCheckFailures.clear();
        this.lastHealthCheck.clear();
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
            const enrichedW3id = w3id.startsWith("@") ? w3id : `@${w3id}`
            console.log("fetching endpoint for :", enrichedW3id)
            const response = await fetch(
                new URL(`/resolve?w3id=${enrichedW3id}`, this.registryUrl).toString(),
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

        // Check if we already have a client for this specific w3id
        if (this.clients.has(w3id)) {
            const client = this.clients.get(w3id)!;
            const endpoint = this.endpoints.get(w3id)!;
            
            // Check if the cached endpoint is still healthy
            if (await this.isEndpointHealthy(w3id, endpoint)) {
                console.log('reusing existing client for w3id:', w3id, 'endpoint:', endpoint);
                return client;
            } else {
                console.log('cached endpoint is unhealthy, removing and re-resolving for w3id:', w3id);
                this.removeCachedClient(w3id);
            }
        }

        // Resolve endpoint for this specific w3id
        const endpoint = await this.resolveEndpoint(w3id).catch(() => null);
        if (!endpoint) throw new Error("Failed to resolve endpoint");

        // Get platform token and create client with authorization header
        const token = await this.ensurePlatformToken();
        const client = new GraphQLClient(endpoint, {
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        // Cache the client and endpoint for this specific w3id
        this.clients.set(w3id, client);
        this.endpoints.set(w3id, endpoint);
        
        // Initialize health check tracking
        this.healthCheckFailures.set(w3id, 0);
        this.lastHealthCheck.set(w3id, Date.now());
        
        console.log('created new client for w3id:', w3id, 'endpoint:', endpoint);
        return client;
    }

    /**
     * Check if a cached endpoint is still healthy
     */
    private async isEndpointHealthy(w3id: string, endpoint: string): Promise<boolean> {
        try {
            // Extract base URL from GraphQL endpoint
            const baseUrl = endpoint.replace('/graphql', '');
            
            // Check if we should perform health check (avoid too frequent checks)
            const now = Date.now();
            const lastCheck = this.lastHealthCheck.get(w3id) || 0;
            const timeSinceLastCheck = now - lastCheck;
            
            // Only check every 30 seconds to avoid performance impact
            if (timeSinceLastCheck < 30000) {
                return true; // Assume healthy if checked recently
            }
            
            // Perform health check on the whois endpoint
            const healthCheckUrl = `${baseUrl}/whois`;
            console.log(`Health checking endpoint for ${w3id}: ${healthCheckUrl}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.HEALTH_CHECK_TIMEOUT);
            
            const response = await fetch(healthCheckUrl, {
                method: 'HEAD',
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                // Reset failure count on success
                this.healthCheckFailures.set(w3id, 0);
                this.lastHealthCheck.set(w3id, now);
                return true;
            } else {
                throw new Error(`Health check failed with status: ${response.status}`);
            }
            
        } catch (error) {
            console.log(`Health check failed for ${w3id}:`, error instanceof Error ? error.message : 'Unknown error');
            
            // Increment failure count
            const currentFailures = this.healthCheckFailures.get(w3id) || 0;
            const newFailures = currentFailures + 1;
            this.healthCheckFailures.set(w3id, newFailures);
            this.lastHealthCheck.set(w3id, Date.now());
            
            // If we've had too many consecutive failures, mark as unhealthy
            if (newFailures >= CONFIG.MAX_HEALTH_CHECK_FAILURES) {
                console.log(`Endpoint for ${w3id} marked as unhealthy after ${newFailures} consecutive failures`);
                return false;
            }
            
            // Still allow some failures before marking as unhealthy
            return true;
        }
    }

    /**
     * Remove cached client and endpoint for a specific w3id
     */
    private removeCachedClient(w3id: string): void {
        this.clients.delete(w3id);
        this.endpoints.delete(w3id);
        this.healthCheckFailures.delete(w3id);
        this.lastHealthCheck.delete(w3id);
        console.log(`Removed cached client for ${w3id}`);
    }

    /**
     * Wrapper for GraphQL requests with timeout handling
     */
    private async withTimeout<T>(
        w3id: string,
        operation: () => Promise<T>
    ): Promise<T> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.log(`GraphQL request timeout for ${w3id}, marking endpoint as unhealthy`);
            this.removeCachedClient(w3id);
        }, CONFIG.GRAPHQL_TIMEOUT);

        try {
            const result = await operation();
            clearTimeout(timeoutId);
            return result;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${CONFIG.GRAPHQL_TIMEOUT}ms`);
            }
            
            throw error;
        }
    }

    /**
     * Manually trigger a health check for a specific w3id
     * Useful for testing or forcing re-resolution
     */
    public async forceHealthCheck(w3id: string): Promise<boolean> {
        if (!this.clients.has(w3id)) {
            console.log(`No cached client found for ${w3id}`);
            return false;
        }

        const endpoint = this.endpoints.get(w3id);
        if (!endpoint) {
            console.log(`No cached endpoint found for ${w3id}`);
            return false;
        }

        // Force health check by clearing last check time
        this.lastHealthCheck.set(w3id, 0);
        
        const isHealthy = await this.isEndpointHealthy(w3id, endpoint);
        
        if (!isHealthy) {
            console.log(`Forced health check failed for ${w3id}, removing cached client`);
            this.removeCachedClient(w3id);
        }
        
        return isHealthy;
    }

    /**
     * Get health status for all cached endpoints
     */
    public getHealthStatus(): Record<string, {
        endpoint: string;
        failures: number;
        lastCheck: number;
        isHealthy: boolean;
    }> {
        const status: Record<string, any> = {};
        
        for (const [w3id, endpoint] of this.endpoints) {
            const failures = this.healthCheckFailures.get(w3id) || 0;
            const lastCheck = this.lastHealthCheck.get(w3id) || 0;
            const isHealthy = failures < CONFIG.MAX_HEALTH_CHECK_FAILURES;
            
            status[w3id] = {
                endpoint,
                failures,
                lastCheck,
                isHealthy,
            };
        }
        
        return status;
    }

    /**
     * Clear all cached clients (useful for testing or forcing fresh connections)
     */
    public clearCache(): void {
        console.log('Clearing all cached clients and endpoints');
        this.clients.clear();
        this.endpoints.clear();
        this.healthCheckFailures.clear();
        this.lastHealthCheck.clear();
    }

    async storeMetaEnvelope(envelope: MetaEnvelope): Promise<string> {
        return this.withRetry(async () => {
            const client = await this.ensureClient(envelope.w3id).catch(() => {
                return null;
            });
            if (!client) return v4();

            console.log("sending to eVault: ", envelope.w3id)
            console.log("sending payload", envelope);

            const response = await this.withTimeout(envelope.w3id, () =>
                client.request<StoreMetaEnvelopeResponse>(STORE_META_ENVELOPE, {
                    input: {
                        ontology: envelope.schemaId,
                        payload: envelope.data,
                        acl: ["*"],
                    },
                })
            ).catch(() => null);

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
