import { createSchema, createYoga, YogaInitialContext } from "graphql-yoga";
import { createServer, Server } from "http";
import { typeDefs } from "./typedefs";
import { renderVoyagerPage } from "graphql-voyager/middleware";
import { getJWTHeader } from "w3id";
import { DbService } from "../db/db.service";
import { VaultAccessGuard, VaultContext } from "./vault-access-guard";
import { GraphQLSchema } from "graphql";
import { exampleQueries } from "./examples/examples";
import axios from "axios";

export class GraphQLServer {
    private db: DbService;
    private accessGuard: VaultAccessGuard;
    private schema: GraphQLSchema = createSchema<VaultContext>({
        typeDefs,
        resolvers: {},
    });
    server?: Server;
    constructor(db: DbService) {
        this.db = db;
        this.accessGuard = new VaultAccessGuard(db);
    }

    public getSchema(): GraphQLSchema {
        return this.schema;
    }

    /**
     * Fetches the list of active platforms from the registry
     * @returns Promise<string[]> - Array of platform URLs
     */
    private async getActivePlatforms(): Promise<string[]> {
        try {
            if (!process.env.REGISTRY_URL) {
                console.error("REGISTRY_URL is not set");
                return [];
            }

            const response = await axios.get(
                new URL("/platforms", process.env.REGISTRY_URL).toString()
            );
            return response.data;
        } catch (error) {
            console.error("Failed to fetch active platforms:", error);
            return [];
        }
    }

    /**
     * Delivers webhooks to all platforms except the requesting one
     * @param requestingPlatform - The platform that made the request (if any)
     * @param webhookPayload - The payload to send to webhooks
     */
    private async deliverWebhooks(
        requestingPlatform: string | null,
        webhookPayload: any
    ): Promise<void> {
        try {
            const activePlatforms = await this.getActivePlatforms();

            // Filter out the requesting platform
            const platformsToNotify = activePlatforms.filter((platformUrl) => {
                if (!requestingPlatform) return true;

                // Normalize URLs for comparison
                const normalizedPlatformUrl = new URL(platformUrl).toString();
                const normalizedRequestingPlatform = new URL(
                    requestingPlatform
                ).toString();

                return normalizedPlatformUrl !== normalizedRequestingPlatform;
            });
            console.log("sending webhooks to ", platformsToNotify);

            // Send webhooks to all other platforms
            const webhookPromises = platformsToNotify.map(
                async (platformUrl) => {
                    try {
                        const webhookUrl = new URL(
                            "/api/webhook",
                            platformUrl
                        ).toString();
                        await axios.post(webhookUrl, webhookPayload, {
                            headers: {
                                "Content-Type": "application/json",
                            },
                            timeout: 5000, // 5 second timeout
                        });
                        console.log(
                            `Webhook delivered successfully to ${platformUrl}`
                        );
                    } catch (error) {
                        console.error(
                            `Failed to deliver webhook to ${platformUrl}:`,
                            error
                        );
                    }
                }
            );

            await Promise.allSettled(webhookPromises);
        } catch (error) {
            console.error("Error in webhook delivery:", error);
        }
    }

    init() {
        const resolvers = {
            JSON: require("graphql-type-json"),

            Query: {
                getMetaEnvelopeById: this.accessGuard.middleware(
                    (_: any, { id }: { id: string }) => {
                        return this.db.findMetaEnvelopeById(id);
                    }
                ),
                findMetaEnvelopesByOntology: this.accessGuard.middleware(
                    (_: any, { ontology }: { ontology: string }) => {
                        return this.db.findMetaEnvelopesByOntology(ontology);
                    }
                ),
                searchMetaEnvelopes: this.accessGuard.middleware(
                    (
                        _: any,
                        { ontology, term }: { ontology: string; term: string }
                    ) => {
                        return this.db.findMetaEnvelopesBySearchTerm(
                            ontology,
                            term
                        );
                    }
                ),
                getAllEnvelopes: this.accessGuard.middleware(() => {
                    return this.db.getAllEnvelopes();
                }),
            },

            Mutation: {
                storeMetaEnvelope: this.accessGuard.middleware(
                    async (
                        _: any,
                        {
                            input,
                        }: {
                            input: {
                                ontology: string;
                                payload: any;
                                acl: string[];
                            };
                        },
                        context: VaultContext
                    ) => {
                        const result = await this.db.storeMetaEnvelope(
                            {
                                ontology: input.ontology,
                                payload: input.payload,
                                acl: input.acl,
                            },
                            input.acl
                        );

                        // Deliver webhooks for create operation
                        const requestingPlatform =
                            context.tokenPayload?.platform || null;
                        const webhookPayload = {
                            id: result.metaEnvelope.id,
                            w3id: `@${process.env.W3ID}`,
                            data: input.payload,
                            schemaId: input.ontology,
                        };

                        /**
                         * To whoever who reads this in the future please don't
                         * remove this delay as this prevents a VERY horrible
                         * disgusting edge case, where if a platform's URL is
                         * not determinable the webhook to the same platform as
                         * the one who sent off the request gets sent and that
                         * is not an ideal case trust me I've suffered, it
                         * causes an absolutely beautiful error where you get
                         * stuck in what I like to call webhook ping-pong
                         */
                        setTimeout(() => {
                            this.deliverWebhooks(
                                requestingPlatform,
                                webhookPayload
                            );
                        }, 3_000);

                        return result;
                    }
                ),
                updateMetaEnvelopeById: this.accessGuard.middleware(
                    async (
                        _: any,
                        {
                            id,
                            input,
                        }: {
                            id: string;
                            input: {
                                ontology: string;
                                payload: any;
                                acl: string[];
                            };
                        },
                        context: VaultContext
                    ) => {
                        try {
                            const result = await this.db.updateMetaEnvelopeById(
                                id,
                                {
                                    ontology: input.ontology,
                                    payload: input.payload,
                                    acl: input.acl,
                                },
                                input.acl
                            );

                            // Deliver webhooks for update operation
                            const requestingPlatform =
                                context.tokenPayload?.platform || null;
                            const webhookPayload = {
                                id: id,
                                w3id: `@${process.env.W3ID}`,
                                data: input.payload,
                                schemaId: input.ontology,
                            };

                            // Fire and forget webhook delivery
                            this.deliverWebhooks(
                                requestingPlatform,
                                webhookPayload
                            );

                            return result;
                        } catch (error) {
                            console.error(
                                "Error in updateMetaEnvelopeById:",
                                error
                            );
                            throw error;
                        }
                    }
                ),
                deleteMetaEnvelope: this.accessGuard.middleware(
                    async (_: any, { id }: { id: string }) => {
                        await this.db.deleteMetaEnvelope(id);
                        return true;
                    }
                ),
                updateEnvelopeValue: this.accessGuard.middleware(
                    async (
                        _: any,
                        {
                            envelopeId,
                            newValue,
                        }: { envelopeId: string; newValue: any }
                    ) => {
                        await this.db.updateEnvelopeValue(envelopeId, newValue);
                        return true;
                    }
                ),
            },
        };

        this.schema = createSchema<VaultContext>({
            typeDefs,
            resolvers,
        });

        const yoga = createYoga({
            schema: this.schema,
            graphqlEndpoint: "/graphql",
            graphiql: {
                defaultQuery: exampleQueries,
            },
            context: async ({ request }) => {
                const authHeader = request.headers.get("authorization") ?? "";
                const token = authHeader.replace("Bearer ", "");

                if (token) {
                    const id = getJWTHeader(token).kid?.split("#")[0];
                    return {
                        currentUser: id ?? null,
                    };
                }

                return {
                    currentUser: null,
                };
            },
        });

        return yoga;
    }
}
