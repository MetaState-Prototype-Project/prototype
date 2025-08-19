export interface MetaEnvelope {
    id?: string | null;
    schemaId: string;
    data: Record<string, any>;
    w3id: string;
}
export declare class EVaultClient {
    private registryUrl;
    private platform;
    private clients;
    private endpoints;
    private tokenInfo;
    private isDisposed;
    constructor(registryUrl: string, platform: string);
    /**
     * Cleanup method to properly dispose of resources
     */
    dispose(): void;
    /**
     * Retry wrapper with exponential backoff
     */
    private withRetry;
    /**
     * Requests a platform token from the registry
     * @returns Promise<string> - The platform token
     */
    private requestPlatformToken;
    /**
     * Checks if token needs refresh
     */
    private isTokenExpired;
    /**
     * Ensures we have a valid platform token, requesting one if needed
     * @returns Promise<string> - The platform token
     */
    private ensurePlatformToken;
    private resolveEndpoint;
    private ensureClient;
    storeMetaEnvelope(envelope: MetaEnvelope): Promise<string>;
    storeReference(referenceId: string, w3id: string): Promise<void>;
    fetchMetaEnvelope(id: string, w3id: string): Promise<MetaEnvelope>;
    updateMetaEnvelopeById(id: string, envelope: MetaEnvelope): Promise<void>;
}
//# sourceMappingURL=evault.d.ts.map