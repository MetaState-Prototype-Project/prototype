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

export function generateNomadJob(w3id: string, eVaultId: string) {
    const neo4jUser = "neo4j";
    const neo4jPassword = generatePassword(24);

    return {
        Job: {
            ID: `evault-${w3id}`,
            Name: `evault-${w3id}`,
            Type: "service",
            Datacenters: ["dc1"],
            TaskGroups: [
                {
                    Name: "evault",
                    Networks: [
                        {
                            Mode: "bridge",
                            DynamicPorts: [
                                {
                                    Label: "http",
                                },
                            ],
                        },
                    ],
                    Services: [
                        {
                            Name: `evault`,
                            PortLabel: "http",
                            Tags: ["internal"],
                            Meta: {
                                whois: w3id,
                                id: eVaultId,
                            },
                        },
                    ],
                    Tasks: [
                        {
                            Name: "neo4j",
                            Driver: "docker",
                            Config: {
                                image: "neo4j:5.15",
                                ports: [],
                            },
                            Env: {
                                NEO4J_AUTH: `${neo4jUser}/${neo4jPassword}`,
                                "dbms.connector.bolt.listen_address":
                                    "0.0.0.0:7687",
                            },
                            Resources: {
                                CPU: 300,
                                MemoryMB: 2048,
                            },
                        },
                        {
                            Name: "evault",
                            Driver: "docker",
                            Config: {
                                image: "merulauvo/evault:latest",
                                ports: ["http"],
                            },
                            Env: {
                                NEO4J_URI: "bolt://localhost:7687",
                                NEO4J_USER: neo4jUser,
                                NEO4J_PASSWORD: neo4jPassword,
                                PORT: "${NOMAD_PORT_http}",
                            },
                            Resources: {
                                CPU: 300,
                                MemoryMB: 512,
                            },
                            DependsOn: ["neo4j"],
                        },
                    ],
                },
            ],
        },
    };
}
