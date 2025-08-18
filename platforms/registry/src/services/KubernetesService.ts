import * as k8s from '@kubernetes/client-node';

export class KubernetesService {
    private kc: k8s.KubeConfig;
    private coreV1Api: k8s.CoreV1Api;

    constructor() {
        this.kc = new k8s.KubeConfig();
        this.kc.loadFromDefault(); // This will load from .kube/config
        
        // Get the current context
        const currentContext = this.kc.getCurrentContext();
        console.log(`Using Kubernetes context: ${currentContext}`);
        
        // Create API client
        this.coreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
    }

    /**
     * Get a working external IP from Kubernetes services
     * This will look for services with LoadBalancer type or NodePort with external IPs
     */
    async getWorkingExternalIp(): Promise<string | null> {
        try {
            console.log('Querying Kubernetes for external IPs...');
            
            // Get all services across all namespaces
            const servicesResponse = await this.coreV1Api.listServiceForAllNamespaces();
            
            const externalIps: string[] = [];
            
            for (const service of servicesResponse.body.items) {
                // Check for LoadBalancer services with external IPs
                if (service.spec?.type === 'LoadBalancer' && service.status?.loadBalancer?.ingress) {
                    for (const ingress of service.status.loadBalancer.ingress) {
                        if (ingress.ip) {
                            externalIps.push(ingress.ip);
                            console.log(`Found LoadBalancer external IP: ${ingress.ip}`);
                        }
                    }
                }
                
                // Check for services with external IPs
                if (service.spec?.externalIPs) {
                    for (const externalIp of service.spec.externalIPs) {
                        externalIps.push(externalIp);
                        console.log(`Found service external IP: ${externalIp}`);
                    }
                }
            }
            
            // Remove duplicates
            const uniqueIps = [...new Set(externalIps)];
            
            if (uniqueIps.length === 0) {
                console.log('No external IPs found in Kubernetes');
                return null;
            }
            
            // Test each IP to find a working one
            for (const ip of uniqueIps) {
                if (await this.testIpConnectivity(ip)) {
                    console.log(`Found working external IP: ${ip}`);
                    return ip;
                }
            }
            
            console.log('No working external IPs found');
            return null;
            
        } catch (error) {
            console.error('Error querying Kubernetes:', error);
            return null;
        }
    }

    /**
     * Test if an IP is reachable
     */
    private async testIpConnectivity(ip: string): Promise<boolean> {
        try {
            // Try to connect to port 80 (HTTP) as a basic connectivity test
            const response = await fetch(`http://${ip}:80`, {
                method: 'HEAD',
                signal: AbortSignal.timeout(3000) // 3 second timeout
            });
            return true;
        } catch (error) {
            console.log(`IP ${ip} is not reachable:`, error instanceof Error ? error.message : 'Unknown error');
            return false;
        }
    }

    /**
     * Get external IPs for a specific service
     */
    async getServiceExternalIps(serviceName: string, namespace: string = 'default'): Promise<string[]> {
        try {
            const service = await this.coreV1Api.readNamespacedService(serviceName, namespace);
            
            const externalIps: string[] = [];
            
            // Check LoadBalancer ingress
            if (service.body.spec?.type === 'LoadBalancer' && service.body.status?.loadBalancer?.ingress) {
                for (const ingress of service.body.status.loadBalancer.ingress) {
                    if (ingress.ip) {
                        externalIps.push(ingress.ip);
                    }
                }
            }
            
            // Check external IPs
            if (service.body.spec?.externalIPs) {
                externalIps.push(...service.body.spec.externalIPs);
            }
            
            return externalIps;
            
        } catch (error) {
            console.error(`Error getting service ${serviceName} in namespace ${namespace}:`, error);
            return [];
        }
    }
} 