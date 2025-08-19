import axios from 'axios';

export class HealthCheckService {
    private readonly timeout = 5000; // 5 second timeout

    /**
     * Check if a URI is healthy by testing its whois endpoint
     */
    async isUriHealthy(uri: string): Promise<boolean> {
        try {
            // Parse the URI to extract IP:PORT
            const { ip, port } = this.parseUri(uri);
            
            if (!ip || !port) {
                console.log(`Invalid URI format: ${uri}`);
                return false;
            }

            // Construct the whois endpoint URL
            const whoisUrl = `http://${ip}:${port}/whois`;
            
            console.log(`Health checking: ${whoisUrl}`);
            
            // Make a request to the whois endpoint with timeout
            const response = await axios.get(whoisUrl, {
                timeout: this.timeout,
                validateStatus: (status) => status < 500 // Accept any status < 500 as "reachable"
            });
            
            console.log(`Health check passed for ${uri}: ${response.status}`);
            return true;
            
        } catch (error) {
            console.log(`Health check failed for ${uri}:`, error instanceof Error ? error.message : 'Unknown error');
            return false;
        }
    }

    /**
     * Parse URI to extract IP and PORT
     * Supports formats: IP:PORT, http://IP:PORT, https://IP:PORT
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
        // Simple regex for IP validation
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