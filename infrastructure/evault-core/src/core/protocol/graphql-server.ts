import { createSchema, createYoga, YogaInitialContext } from "graphql-yoga";
import { createServer, Server } from "http";
import { typeDefs } from "./typedefs";
import { renderVoyagerPage } from "graphql-voyager/middleware";
import { getJWTHeader } from "w3id";
import { DbService } from "../db/db.service";
import {
    computeEnvelopeHash,
    computeEnvelopeHashForDelete,
} from "../db/envelope-hash";
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
    private evaultPublicKey: string | null;
    private evaultW3ID: string | null;
    private evaultInstance: any; // Reference to the eVault instance

    constructor(db: DbService, evaultPublicKey?: string | null, evaultW3ID?: string | null, evaultInstance?: any) {
        this.db = db;
        this.accessGuard = new VaultAccessGuard(db);
        this.evaultPublicKey = evaultPublicKey || process.env.EVAULT_PUBLIC_KEY || null;
        this.evaultW3ID = evaultW3ID || process.env.W3ID || null;
        this.evaultInstance = evaultInstance;
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
            if (!process.env.PUBLIC_REGISTRY_URL) {
                console.error("REGISTRY_URL is not set");
                return [];
            }

            const response = await axios.get(
                new URL("/platforms", process.env.PUBLIC_REGISTRY_URL).toString()
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

                try {
                    // Normalize URLs for comparison
                    const normalizedPlatformUrl = new URL(platformUrl).toString();
                    const normalizedRequestingPlatform = new URL(
                        requestingPlatform
                    ).toString();

                    return normalizedPlatformUrl !== normalizedRequestingPlatform;
                } catch (error) {
                    // If requestingPlatform is not a valid URL, don't filter it out
                    // (treat it as a different platform identifier)
                    console.warn(`Invalid platform URL in token: ${requestingPlatform}`);
                    return true;
                }
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

    /**
     * Gets the current eVault W3ID dynamically from the eVault instance
     * @returns string | null - The current eVault W3ID
     */
    private getCurrentEvaultW3ID(): string | null {
        if (this.evaultInstance && this.evaultInstance.w3id) {
            return this.evaultInstance.w3id;
        }
        return this.evaultW3ID;
    }

    init() {
        const resolvers = {
            JSON: require("graphql-type-json"),

            Query: {
                getMetaEnvelopeById: this.accessGuard.middleware(
                    (_: any, { id }: { id: string }, context: VaultContext) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        return this.db.findMetaEnvelopeById(id, context.eName);
                    }
                ),
                findMetaEnvelopesByOntology: this.accessGuard.middleware(
                    (_: any, { ontology }: { ontology: string }, context: VaultContext) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        return this.db.findMetaEnvelopesByOntology(ontology, context.eName);
                    }
                ),
                searchMetaEnvelopes: this.accessGuard.middleware(
                    (
                        _: any,
                        { ontology, term }: { ontology: string; term: string },
                        context: VaultContext
                    ) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        return this.db.findMetaEnvelopesBySearchTerm(
                            ontology,
                            term,
                            context.eName
                        );
                    }
                ),
                getAllEnvelopes: this.accessGuard.middleware((_: any, __: any, context: VaultContext) => {
                    if (!context.eName) {
                        throw new Error("X-ENAME header is required");
                    }
                    return this.db.getAllEnvelopes(context.eName);
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
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        const result = await this.db.storeMetaEnvelope(
                            {
                                ontology: input.ontology,
                                payload: input.payload,
                                acl: input.acl,
                            },
                            input.acl,
                            context.eName
                        );

                        // Add parsed field to metaEnvelope for GraphQL response
                        const metaEnvelopeWithParsed = {
                            ...result.metaEnvelope,
                            parsed: input.payload,
                        };

                        // Deliver webhooks for create operation
                        const requestingPlatform =
                            context.tokenPayload?.platform || null;
                        const webhookPayload = {
                            id: result.metaEnvelope.id,
                            w3id: context.eName,
                            evaultPublicKey: this.evaultPublicKey,
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

                        // Log envelope operation best-effort (do not fail mutation)
                        const platform =
                            context.tokenPayload?.platform ?? null;
                        const metaEnvelopeId = result.metaEnvelope.id;
                        const envelopeHash = computeEnvelopeHash({
                            id: metaEnvelopeId,
                            ontology: input.ontology,
                            payload: input.payload,
                        });
                        this.db
                            .appendEnvelopeOperationLog({
                                eName: context.eName,
                                metaEnvelopeId,
                                envelopeHash,
                                operation: "create",
                                platform,
                                timestamp: new Date().toISOString(),
                                ontology: input.ontology,
                            })
                            .catch((err) =>
                                console.error(
                                    "appendEnvelopeOperationLog (create) failed:",
                                    err,
                                ),
                            );

                        return {
                            ...result,
                            metaEnvelope: metaEnvelopeWithParsed,
                        };
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
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        try {
                            const result = await this.db.updateMetaEnvelopeById(
                                id,
                                {
                                    ontology: input.ontology,
                                    payload: input.payload,
                                    acl: input.acl,
                                },
                                input.acl,
                                context.eName
                            );

                            // Deliver webhooks for update operation
                            const requestingPlatform =
                                context.tokenPayload?.platform || null;
                            const webhookPayload = {
                                id: id,
                                w3id: context.eName,
                                evaultPublicKey: this.evaultPublicKey,
                                data: input.payload,
                                schemaId: input.ontology,
                            };

                            // Fire and forget webhook delivery
                            this.deliverWebhooks(
                                requestingPlatform,
                                webhookPayload
                            );

                            // Log envelope operation best-effort (do not fail mutation)
                            const platform =
                                context.tokenPayload?.platform ?? null;
                            const envelopeHash = computeEnvelopeHash({
                                id,
                                ontology: input.ontology,
                                payload: input.payload,
                            });
                            this.db
                                .appendEnvelopeOperationLog({
                                    eName: context.eName,
                                    metaEnvelopeId: id,
                                    envelopeHash,
                                    operation: "update",
                                    platform,
                                    timestamp: new Date().toISOString(),
                                    ontology: input.ontology,
                                })
                                .catch((err) =>
                                    console.error(
                                        "appendEnvelopeOperationLog (update) failed:",
                                        err,
                                    ),
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
                    async (_: any, { id }: { id: string }, context: VaultContext) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        const meta =
                            await this.db.findMetaEnvelopeById(id, context.eName);
                        await this.db.deleteMetaEnvelope(id, context.eName);
                        // Log after delete succeeds, best-effort
                        const platform =
                            context.tokenPayload?.platform ?? null;
                        const envelopeHash = computeEnvelopeHashForDelete(id);
                        this.db
                            .appendEnvelopeOperationLog({
                                eName: context.eName,
                                metaEnvelopeId: id,
                                envelopeHash,
                                operation: "delete",
                                platform,
                                timestamp: new Date().toISOString(),
                                ontology: meta?.ontology ?? undefined,
                            })
                            .catch((err) =>
                                console.error(
                                    "appendEnvelopeOperationLog (delete) failed:",
                                    err,
                                ),
                            );
                        return true;
                    }
                ),
                updateEnvelopeValue: this.accessGuard.middleware(
                    async (
                        _: any,
                        {
                            envelopeId,
                            newValue,
                        }: { envelopeId: string; newValue: any },
                        context: VaultContext
                    ) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        const metaInfo =
                            await this.db.getMetaEnvelopeIdByEnvelopeId(
                                envelopeId,
                                context.eName,
                            );
                        await this.db.updateEnvelopeValue(
                            envelopeId,
                            newValue,
                            context.eName,
                        );
                        if (metaInfo) {
                            const platform =
                                context.tokenPayload?.platform ?? null;
                            const envelopeHash = computeEnvelopeHash({
                                id: envelopeId,
                                ontology: metaInfo.ontology,
                                payload: { envelopeId, newValue },
                            });
                            this.db
                                .appendEnvelopeOperationLog({
                                    eName: context.eName,
                                    metaEnvelopeId: metaInfo.metaEnvelopeId,
                                    envelopeHash,
                                    operation: "update_envelope_value",
                                    platform,
                                    timestamp: new Date().toISOString(),
                                    ontology: metaInfo.ontology,
                                })
                                .catch((err) =>
                                    console.error(
                                        "appendEnvelopeOperationLog (update_envelope_value) failed:",
                                        err,
                                    ),
                                );
                        }
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
                const eName = request.headers.get("x-ename") ?? request.headers.get("X-ENAME") ?? null;

                if (token) {
                    try {
                        const id = getJWTHeader(token).kid?.split("#")[0];
                        return {
                            currentUser: id ?? null,
                            eName: eName,
                        };
                    } catch (error) {
                        // Invalid JWT token - ignore and continue without currentUser
                        return {
                            currentUser: null,
                            eName: eName,
                        };
                    }
                }

                return {
                    currentUser: null,
                    eName: eName,
                };
            },
        });

        return yoga;
    }
}
