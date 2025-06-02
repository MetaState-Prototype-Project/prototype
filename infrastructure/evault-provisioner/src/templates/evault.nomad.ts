import sha256 from "sha256";
import * as k8s from '@kubernetes/client-node';

export function generatePassword(length = 16): string {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const charsLength = chars.length;
    const randomValues = new Uint32Array(length);

    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
        result += chars.charAt(randomValues[i] % charsLength);
    }

    return result;
}

export async function provisionEVault(w3id: string, eVaultId: string) {
    const idParts = w3id.split('@');
    w3id = idParts[idParts.length - 1]
    const neo4jPassword = sha256(w3id)

    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    const coreApi = kc.makeApiClient(k8s.CoreV1Api);
    const appsApi = kc.makeApiClient(k8s.AppsV1Api);

    const namespaceName = `evault-${w3id}`;
    const containerPort = 4000;

    const namespace = await coreApi.createNamespace({ body: { metadata: { name: namespaceName } } });

    const pvcSpec = (name: string) => ({
        metadata: { name, namespace: namespaceName },
        spec: {
            accessModes: ['ReadWriteOnce'],
            resources: { requests: { storage: '1Gi' } }
        }
    });
    await coreApi.createNamespacedPersistentVolumeClaim({ namespace: namespaceName, body: pvcSpec('neo4j-data') });
    await coreApi.createNamespacedPersistentVolumeClaim({ namespace: namespaceName, body: pvcSpec('evault-store') });

    const deployment = {
        metadata: { name: 'evault', namespace: namespaceName },
        spec: {
            replicas: 1,
            selector: { matchLabels: { app: 'evault' } },
            template: {
                metadata: { labels: { app: 'evault' } },
                spec: {
                    containers: [
                        {
                            name: 'neo4j',
                            image: 'neo4j:5.15',
                            ports: [{ containerPort: 7687 }],
                            env: [
                                { name: 'NEO4J_AUTH', value: `neo4j/${neo4jPassword}` },
                                { name: 'dbms.connector.bolt.listen_address', value: '0.0.0.0:7687' }
                            ],
                            volumeMounts: [{ name: 'neo4j-data', mountPath: '/data' }]
                        },
                        {
                            name: 'evault',
                            image: 'merulauvo/evault:latest',
                            ports: [{ containerPort }],
                            env: [
                                { name: 'NEO4J_URI', value: 'bolt://localhost:7687' },
                                { name: 'NEO4J_USER', value: 'neo4j' },
                                { name: 'NEO4J_PASSWORD', value: neo4jPassword },
                                { name: 'PORT', value: containerPort.toString() },
                                { name: 'W3ID', value: w3id }
                            ],
                            volumeMounts: [{ name: 'evault-store', mountPath: '/evault/data' }]
                        }
                    ],
                    volumes: [
                        { name: 'neo4j-data', persistentVolumeClaim: { claimName: 'neo4j-data' } },
                        { name: 'evault-store', persistentVolumeClaim: { claimName: 'evault-store' } }
                    ]
                }
            }
        }
    };

    await appsApi.createNamespacedDeployment({ body: deployment, namespace: namespaceName });

    const serviceSpec = {
        metadata: { name: 'evault-service', namespace: namespaceName },
        spec: {
            type: 'NodePort',
            selector: { app: 'evault' },
            ports: [
                {
                    port: 80,
                    targetPort: containerPort,
                    protocol: 'TCP'
                    // No nodePort → let Kubernetes assign one dynamically
                }
            ]
        }
    };

    await coreApi.createNamespacedService({ body: serviceSpec, namespace: namespaceName });

    const res = await coreApi.readNamespacedService({ name: 'evault-service', namespace: namespaceName });
    console.log(JSON.stringify(res))
}
