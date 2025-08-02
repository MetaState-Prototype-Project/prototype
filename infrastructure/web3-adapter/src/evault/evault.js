"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVaultClient = void 0;
const node_http_1 = require("node:http");
const axios_1 = __importDefault(require("axios"));
const graphql_request_1 = require("graphql-request");
const uuid_1 = require("uuid");
// Configuration constants
const CONFIG = {
    REQUEST_TIMEOUT: 30000, // 30 seconds
    CONNECTION_TIMEOUT: 10000, // 10 seconds
    TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second base delay
    CONNECTION_POOL_SIZE: 10,
};
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
class EVaultClient {
    constructor(registryUrl, platform) {
        this.registryUrl = registryUrl;
        this.platform = platform;
        this.client = null;
        this.endpoint = null;
        this.tokenInfo = null;
        this.isDisposed = false;
        // Configure axios with connection pooling and timeouts
        this.httpClient = axios_1.default.create({
            timeout: CONFIG.REQUEST_TIMEOUT,
            maxRedirects: 3,
            // Connection pooling configuration
            httpAgent: new node_http_1.Agent({
                keepAlive: true,
                maxSockets: CONFIG.CONNECTION_POOL_SIZE,
                timeout: CONFIG.CONNECTION_TIMEOUT,
            }),
            httpsAgent: new node_http_1.Agent({
                keepAlive: true,
                maxSockets: CONFIG.CONNECTION_POOL_SIZE,
                timeout: CONFIG.CONNECTION_TIMEOUT,
            }),
        });
    }
    /**
     * Cleanup method to properly dispose of resources
     */
    dispose() {
        if (this.isDisposed)
            return;
        this.isDisposed = true;
        this.client = null;
        this.endpoint = null;
        this.tokenInfo = null;
        // Close HTTP agents to free connections
        if (this.httpClient.defaults.httpAgent) {
            this.httpClient.defaults.httpAgent.destroy();
        }
        if (this.httpClient.defaults.httpsAgent) {
            this.httpClient.defaults.httpsAgent.destroy();
        }
    }
    /**
     * Retry wrapper with exponential backoff
     */
    async withRetry(operation, maxRetries = CONFIG.MAX_RETRIES) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                // Don't retry on the last attempt
                if (attempt === maxRetries)
                    break;
                // Don't retry on certain errors
                if (error instanceof Error) {
                    const isRetryable = !(error.message.includes("401") ||
                        error.message.includes("403") ||
                        error.message.includes("404"));
                    if (!isRetryable)
                        break;
                }
                // Exponential backoff
                const delay = CONFIG.RETRY_DELAY * 2 ** attempt;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        throw lastError;
    }
    /**
     * Requests a platform token from the registry
     * @returns Promise<string> - The platform token
     */
    async requestPlatformToken() {
        try {
            const response = await this.httpClient.post(new URL("/platforms/certification", this.registryUrl).toString(), { platform: this.platform }, {
                headers: {
                    "Content-Type": "application/json",
                },
                timeout: CONFIG.REQUEST_TIMEOUT,
            });
            const now = Date.now();
            const expiresAt = response.data.expiresAt || now + 3600000; // Default 1 hour
            return {
                token: response.data.token,
                expiresAt,
                obtainedAt: now,
            };
        }
        catch (error) {
            console.error("Error requesting platform token:", error);
            throw new Error("Failed to request platform token");
        }
    }
    /**
     * Checks if token needs refresh
     */
    isTokenExpired() {
        if (!this.tokenInfo)
            return true;
        const now = Date.now();
        const timeUntilExpiry = this.tokenInfo.expiresAt - now;
        return timeUntilExpiry <= CONFIG.TOKEN_REFRESH_THRESHOLD;
    }
    /**
     * Ensures we have a valid platform token, requesting one if needed
     * @returns Promise<string> - The platform token
     */
    async ensurePlatformToken() {
        if (!this.tokenInfo || this.isTokenExpired()) {
            this.tokenInfo = await this.requestPlatformToken();
        }
        return this.tokenInfo.token;
    }
    async resolveEndpoint(w3id) {
        try {
            const response = await this.httpClient.get(new URL(`/resolve?w3id=${w3id}`, this.registryUrl).toString(), {
                timeout: CONFIG.REQUEST_TIMEOUT,
            });
            return new URL("/graphql", response.data.uri).toString();
        }
        catch (error) {
            console.error("Error resolving eVault endpoint:", error);
            throw new Error("Failed to resolve eVault endpoint");
        }
    }
    async ensureClient(w3id) {
        if (this.isDisposed) {
            throw new Error("EVaultClient has been disposed");
        }
        if (!this.endpoint || !this.client) {
            this.endpoint = await this.resolveEndpoint(w3id).catch(() => null);
            if (!this.endpoint)
                throw new Error("Failed to resolve endpoint");
            // Get platform token and create client with authorization header
            const token = await this.ensurePlatformToken();
            this.client = new graphql_request_1.GraphQLClient(this.endpoint, {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            });
        }
        return this.client;
    }
    async storeMetaEnvelope(envelope) {
        return this.withRetry(async () => {
            const client = await this.ensureClient(envelope.w3id).catch(() => {
                return null;
            });
            if (!client)
                return (0, uuid_1.v4)();
            console.log("sending payload", envelope);
            const response = await client
                .request(STORE_META_ENVELOPE, {
                input: {
                    ontology: envelope.schemaId,
                    payload: envelope.data,
                    acl: ["*"],
                },
            })
                .catch(() => null);
            if (!response)
                return (0, uuid_1.v4)();
            return response.storeMetaEnvelope.metaEnvelope.id;
        });
    }
    async storeReference(referenceId, w3id) {
        return this.withRetry(async () => {
            const client = await this.ensureClient(w3id);
            const response = await client
                .request(STORE_META_ENVELOPE, {
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
    async fetchMetaEnvelope(id, w3id) {
        return this.withRetry(async () => {
            const client = await this.ensureClient(w3id);
            try {
                const response = await client.request(FETCH_META_ENVELOPE, {
                    id,
                    w3id,
                });
                return response.metaEnvelope;
            }
            catch (error) {
                console.error("Error fetching meta envelope:", error);
                throw error;
            }
        });
    }
    async updateMetaEnvelopeById(id, envelope) {
        return this.withRetry(async () => {
            console.log("sending to eVault", envelope.w3id);
            const client = await this.ensureClient(envelope.w3id).catch(() => null);
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
                const response = await client.request(UPDATE_META_ENVELOPE, variables);
            }
            catch (error) {
                console.error("Error updating meta envelope:", error);
                throw error;
            }
        });
    }
}
exports.EVaultClient = EVaultClient;
//# sourceMappingURL=evault.js.map