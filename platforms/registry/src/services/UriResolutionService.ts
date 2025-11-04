/**
 * Simplified URI resolution service.
 * In multi-tenant architecture, URIs are stored as IP:PORT and returned directly.
 * No Kubernetes fallback needed since all eVaults share the same infrastructure.
 */
export class UriResolutionService {
    /**
     * Resolve a URI - in multi-tenant mode, just return the stored URI as-is
     * (IP:PORT format pointing to shared evault-core service)
     */
    async resolveUri(originalUri: string): Promise<string> {
        // In multi-tenant architecture, URIs are stored as IP:PORT and don't need resolution
        // Just return the stored URI directly
        return originalUri;
    }
} 