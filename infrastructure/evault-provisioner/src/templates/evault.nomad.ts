import sha256 from "sha256";
import * as k8s from "@kubernetes/client-node";
import { execSync } from "child_process";
import { json } from "express";

/**
 * Generates a cryptographically secure random alphanumeric password of the specified length.
 *
 * @param length - The desired length of the generated password. Defaults to 16.
 * @returns A random password consisting of uppercase letters, lowercase letters, and digits.
 */
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

/**
 * Provisions an eVault environment in a dedicated Kubernetes namespace and returns its accessible URL.
 *
 * Creates a namespace, persistent volume claims, a deployment with Neo4j and eVault containers, and a LoadBalancer service. The Neo4j password is derived by hashing the domain part of the provided {@link w3id}. The function determines the service endpoint using the LoadBalancer IP/hostname, node IP and NodePort, or Minikube IP as a fallback.
 *
 * @param w3id - The W3ID identifier, used to derive the namespace and database password.
 * @param eVaultId - The unique identifier for the eVault instance.
 * @returns The HTTP URL for accessing the provisioned eVault service.
 *
 * @throws {Error} If the service endpoint cannot be determined from the cluster.
 */
export async function provisionEVault(w3id: string, registryUrl: string, publicKey: string) {
    console.log("starting to provision");
    const idParts = w3id.split("@");
    w3id = idParts[idParts.length - 1];
    const neo4jPassword = sha256(w3id);

    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    const coreApi = kc.makeApiClient(k8s.CoreV1Api);
    const appsApi = kc.makeApiClient(k8s.AppsV1Api);

    const namespaceName = `evault-${w3id}`;
    const containerPort = 4000;

    const namespace = await coreApi.createNamespace({
        body: { metadata: { name: namespaceName } },
    });

    const pvcSpec = (name: string) => ({
        metadata: { name, namespace: namespaceName },
        spec: {
            accessModes: ["ReadWriteOnce"],
            resources: { requests: { storage: "1Gi" } },
        },
    });
    await coreApi.createNamespacedPersistentVolumeClaim({
        namespace: namespaceName,
        body: pvcSpec("neo4j-data"),
    });
    await coreApi.createNamespacedPersistentVolumeClaim({
        namespace: namespaceName,
        body: pvcSpec("evault-store"),
    });
    await coreApi.createNamespacedPersistentVolumeClaim({
        namespace: namespaceName,
        body: {
            metadata: { name: "evault-secrets", namespace: namespaceName },
            spec: {
                accessModes: ["ReadWriteOnce"],
                resources: {
                    requests: {
                        storage: "2Mi",
                    },
                },
            },
        },
    });

    const deployment = {
        metadata: { name: "evault", namespace: namespaceName },
        spec: {
            replicas: 1,
            selector: { matchLabels: { app: "evault" } },
            template: {
                metadata: { labels: { app: "evault" } },
                spec: {
                    containers: [
                        {
                            name: "neo4j",
                            image: "neo4j:5.15",
                            ports: [{ containerPort: 7687 }],
                            env: [
                                {
                                    name: "NEO4J_AUTH",
                                    value: `neo4j/${neo4jPassword}`,
                                },
                                {
                                    name: "dbms.connector.bolt.listen_address",
                                    value: "0.0.0.0:7687",
                                },
                            ],
                            volumeMounts: [
                                { name: "neo4j-data", mountPath: "/data" },
                            ],
                        },
                        {
                            name: "evault",
                            image: "merulauvo/evault:latest",
                            // image: "local-evault:latest",
                            // imagePullPolicy: "Never",
                            ports: [{ containerPort }],
                            env: [
                                {
                                    name: "NEO4J_URI",
                                    value: "bolt://localhost:7687",
                                },
                                { name: "NEO4J_USER", value: "neo4j" },
                                {
                                    name: "REGISTRY_URL",
                                    value: registryUrl,
                                },
                                {
                                    name: "EVAULT_PUBLIC_KEY", 
                                    value: publicKey
                                },
                                {
                                    name: "NEO4J_PASSWORD",
                                    value: neo4jPassword,
                                },
                                {
                                    name: "PORT",
                                    value: containerPort.toString(),
                                },
                                { name: "W3ID", value: w3id },
                                {
                                    name: "ENCRYPTION_PASSWORD",
                                    value: neo4jPassword,
                                },
                                {
                                    name: "SECRETS_STORE_PATH",
                                    value: "/secrets",
                                },
                            ],
                            volumeMounts: [
                                {
                                    name: "evault-store",
                                    mountPath: "/evault/data",
                                },
                            ],
                        },
                    ],
                    volumes: [
                        {
                            name: "neo4j-data",
                            persistentVolumeClaim: { claimName: "neo4j-data" },
                        },
                        {
                            name: "evault-store",
                            persistentVolumeClaim: {
                                claimName: "evault-store",
                            },
                        },
                        {
                            name: "evault-secrets",
                            persistentVolumeClaim: {
                                claimName: "evault-secrets",
                            },
                        },
                    ],
                },
            },
        },
    };

    await appsApi.createNamespacedDeployment({
        body: deployment,
        namespace: namespaceName,
    });

    await coreApi.createNamespacedService({
        namespace: namespaceName,
        body: {
            apiVersion: "v1",
            kind: "Service",
            metadata: { name: "evault-service" },
            spec: {
                type: "NodePort",
                selector: { app: "evault" },
                ports: [
                    {
                        port: 4000,
                        targetPort: 4000,
                    },
                ],
            },
        },
    });

    // Get the service and node info
    const svc = await coreApi.readNamespacedService({
        name: "evault-service",
        namespace: namespaceName,
    });
    const nodePort = svc.spec?.ports?.[0]?.nodePort;
    if (!nodePort) throw new Error("No NodePort assigned");

    // Get the node's external IP
    const nodes = await coreApi.listNode();
    const node = nodes.items[0];
    if (!node) throw new Error("No nodes found in cluster");

    let externalIP = node.status?.addresses?.find(
        (addr) => addr.type === "ExternalIP"
    )?.address;

    if (!externalIP) externalIP = process.env.IP_ADDR;
    return `http://${externalIP}:${nodePort}`;
}
