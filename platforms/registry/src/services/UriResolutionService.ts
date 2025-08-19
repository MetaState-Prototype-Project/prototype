import { HealthCheckService } from './HealthCheckService';
import { KubernetesService } from './KubernetesService';

export class UriResolutionService {
    private healthCheckService: HealthCheckService;
    private kubernetesService: KubernetesService;

    constructor() {
        this.healthCheckService = new HealthCheckService();
        this.kubernetesService = new KubernetesService();
    }

    /**
     * Resolve a URI with health check and Kubernetes fallback
     */
    async resolveUri(originalUri: string): Promise<string> {
        console.log(`Resolving URI: ${originalUri}`);
        
        // First, check if the original URI is healthy
        const isHealthy = await this.healthCheckService.isUriHealthy(originalUri);
        
        if (isHealthy) {
            console.log(`URI ${originalUri} is healthy, returning original`);
            return originalUri;
        }
        
        console.log(`URI ${originalUri} is unhealthy, attempting Kubernetes fallback`);
        
        // URI is unhealthy, try to get a working external IP from Kubernetes
        const workingIp = await this.kubernetesService.getWorkingExternalIp();
        
        if (!workingIp) {
            console.log('No working external IP found in Kubernetes, returning original URI');
            return originalUri; // Fallback to original if no working IP found
        }
        
        // Extract port from original URI and construct new URI with working IP
        const { port } = this.parseUri(originalUri);
        
        if (!port) {
            console.log('Could not extract port from original URI, returning original');
            return originalUri;
        }
        
        const newUri = `http://${workingIp}:${port}`;
        console.log(`Substituted ${originalUri} with ${newUri} using working IP from Kubernetes`);
        
        return newUri;
    }

    /**
     * Parse URI to extract IP and PORT (duplicated from HealthCheckService for convenience)
     */
    private parseUri(uri: string): { ip: string | null; port: string | null } {
        try {
            // Remove protocol if present
            const cleanUri = uri.replace(/^https?:\/\//, '');
            
            // Split by colon to get IP and PORT
            const parts = cleanUri.split(':');
            
            if (parts.length === 2) {
                const ip = parts[0];
                const port = parts[1];
                
                // Basic validation
                if (this.isValidIp(ip) && this.isValidPort(port)) {
                    return { ip, port };
                }
            }
            
            return { ip: null, port: null };
        } catch (error) {
            console.error(`Error parsing URI ${uri}:`, error);
            return { ip: null, port: null };
        }
    }

    /**
     * Basic IP validation
     */
    private isValidIp(ip: string): boolean {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    }

    /**
     * Basic port validation
     */
    private isValidPort(port: string): boolean {
        const portNum = parseInt(port, 10);
        return portNum >= 1 && portNum <= 65535;
    }
} 