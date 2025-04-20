export function generateNomadJob(
    tenantId: string,
    neo4jUser: string,
    neo4jPassword: string,
) {
    return {
        Job: {
            ID: `evault-${tenantId}`,
            Name: `evault-${tenantId}`,
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
                            Name: `evault-${tenantId}`,
                            PortLabel: "http",
                            Tags: ["internal"],
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
