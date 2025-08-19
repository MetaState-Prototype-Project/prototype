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
     * Get a working external IP from Kubernetes nodes
     */
    async getWorkingExternalIp(): Promise<string | null> {
        try {
            console.log('Querying Kubernetes for node external IPs...');
            
            const nodesResponse = await this.coreV1Api.listNode();
            const externalIps: string[] = [];
            
            for (const node of nodesResponse.body.items) {
                if (node.status?.addresses) {
                    for (const address of node.status.addresses) {
                        if (address.type === 'ExternalIP' && address.address) {
                            externalIps.push(address.address);
                            console.log(`Found node external IP: ${address.address}`);
                        }
                    }
                }
            }
            
            if (externalIps.length === 0) {
                console.log('No external IPs found in Kubernetes nodes');
                return null;
            }
            
            console.log(`Found ${externalIps.length} external IPs:`, externalIps);
            
            // Just return the first external IP we find
            const workingIp = externalIps[0];
            console.log(`Using external IP: ${workingIp}`);
            return workingIp;
            
        } catch (error) {
            console.error('Error querying Kubernetes nodes:', error);
            return null;
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

    /**
     * Get all node external IPs
     */
    async getNodeExternalIps(): Promise<string[]> {
        try {
            const nodesResponse = await this.coreV1Api.listNode();
            const externalIps: string[] = [];
            
            for (const node of nodesResponse.body.items) {
                if (node.status?.addresses) {
                    for (const address of node.status.addresses) {
                        if (address.type === 'ExternalIP' && address.address) {
                            externalIps.push(address.address);
                        }
                    }
                }
            }
            
            return externalIps;
            
        } catch (error) {
            console.error('Error getting node external IPs:', error);
            return [];
        }
    }

    /**
     * Debug method to show node external IPs
     */
    async debugExternalIps(): Promise<{
        nodeExternalIps: string[];
    }> {
        const nodeExternalIps = await this.getNodeExternalIps();
        
        return {
            nodeExternalIps,
        };
    }
} 