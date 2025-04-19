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
                            Mode: "host",
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
                            },
                            Env: {
                                NEO4J_AUTH: `${neo4jUser}/${neo4jPassword}`,
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
                                port_map: [
                                    {
                                        http: 4000,
                                    },
                                ],
                            },
                            Env: {
                                NEO4J_URI: "bolt://localhost:7687",
                                NEO4J_USER: neo4jUser,
                                NEO4J_PASSWORD: neo4jPassword,
                            },
                            Resources: {
                                CPU: 300,
                                MemoryMB: 512,
                            },
                        },
                    ],
                },
            ],
        },
    };
}
