import { type Server, createServer } from "http";
import axios from "axios";
import type { GraphQLSchema } from "graphql";
import { renderVoyagerPage } from "graphql-voyager/middleware";
import { YogaInitialContext, createSchema, createYoga } from "graphql-yoga";
import { getJWTHeader } from "w3id";
import { BindingDocumentService } from "../../services/BindingDocumentService";
import type { DbService } from "../db/db.service";
import {
    computeEnvelopeHash,
    computeEnvelopeHashForDelete,
} from "../db/envelope-hash";
import { exampleQueries } from "./examples/examples";
import { typeDefs } from "./typedefs";
import { VaultAccessGuard, type VaultContext } from "./vault-access-guard";

export class GraphQLServer {
    private db: DbService;
    private accessGuard: VaultAccessGuard;
    private bindingDocumentService: BindingDocumentService;
    private schema: GraphQLSchema = createSchema<VaultContext>({
        typeDefs,
        resolvers: {},
    });
    server?: Server;
    private evaultPublicKey: string | null;
    private evaultW3ID: string | null;
    private evaultInstance: any; // Reference to the eVault instance

    constructor(
        db: DbService,
        evaultPublicKey?: string | null,
        evaultW3ID?: string | null,
        evaultInstance?: any,
    ) {
        this.db = db;
        this.accessGuard = new VaultAccessGuard(db);
        this.bindingDocumentService = new BindingDocumentService(db);
        this.evaultPublicKey =
            evaultPublicKey || process.env.EVAULT_PUBLIC_KEY || null;
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
                new URL(
                    "/platforms",
                    process.env.PUBLIC_REGISTRY_URL,
                ).toString(),
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
        webhookPayload: any,
    ): Promise<void> {
        try {
            const activePlatforms = await this.getActivePlatforms();

            // Filter out the requesting platform
            const platformsToNotify = activePlatforms.filter((platformUrl) => {
                if (!requestingPlatform) return true;

                try {
                    // Normalize URLs for comparison
                    const normalizedPlatformUrl = new URL(
                        platformUrl,
                    ).toString();
                    const normalizedRequestingPlatform = new URL(
                        requestingPlatform,
                    ).toString();

                    return (
                        normalizedPlatformUrl !== normalizedRequestingPlatform
                    );
                } catch (error) {
                    // If requestingPlatform is not a valid URL, don't filter it out
                    // (treat it as a different platform identifier)
                    console.warn(
                        `Invalid platform URL in token: ${requestingPlatform}`,
                    );
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
                            platformUrl,
                        ).toString();
                        await axios.post(webhookUrl, webhookPayload, {
                            headers: {
                                "Content-Type": "application/json",
                            },
                            timeout: 5000, // 5 second timeout
                        });
                        console.log(
                            `Webhook delivered successfully to ${platformUrl}`,
                        );
                    } catch (error) {
                        console.error(
                            `Failed to deliver webhook to ${platformUrl}:`,
                            error,
                        );
                    }
                },
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

            // Field resolver for Envelope.fieldKey (alias for ontology)
            Envelope: {
                fieldKey: (parent: any) => parent.ontology,
            },

            Query: {
                // ============================================================
                // NEW IDIOMATIC API
                // ============================================================

                // Retrieve a single MetaEnvelope by ID
                metaEnvelope: this.accessGuard.middleware(
                    (_: any, { id }: { id: string }, context: VaultContext) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        return this.db.findMetaEnvelopeById(id, context.eName);
                    },
                ),

                bindingDocument: this.accessGuard.middleware(
                    async (
                        _: any,
                        { id }: { id: string },
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        return this.bindingDocumentService.getBindingDocument(
                            id,
                            context.eName,
                        );
                    },
                ),

                bindingDocuments: this.accessGuard.middleware(
                    async (
                        _: any,
                        args: {
                            type?: string;
                            first?: number;
                            after?: string;
                            last?: number;
                            before?: string;
                        },
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        return this.bindingDocumentService.findBindingDocuments(
                            context.eName,
                            {
                                type: args.type as any,
                                first: args.first,
                                after: args.after,
                                last: args.last,
                                before: args.before,
                            },
                        );
                    },
                ),

                // Retrieve MetaEnvelopes with pagination and filtering
                metaEnvelopes: this.accessGuard.middleware(
                    async (
                        _: any,
                        args: {
                            filter?: {
                                ontologyId?: string;
                                search?: {
                                    term?: string;
                                    caseSensitive?: boolean;
                                    fields?: string[];
                                    mode?: "CONTAINS" | "STARTS_WITH" | "EXACT";
                                };
                            };
                            first?: number;
                            after?: string;
                            last?: number;
                            before?: string;
                        },
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        return this.db.findMetaEnvelopesPaginated(
                            context.eName,
                            {
                                filter: args.filter,
                                first: args.first,
                                after: args.after,
                                last: args.last,
                                before: args.before,
                            },
                        );
                    },
                ),

                // ============================================================
                // LEGACY API (preserved for backward compatibility)
                // ============================================================

                getMetaEnvelopeById: this.accessGuard.middleware(
                    (_: any, { id }: { id: string }, context: VaultContext) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        return this.db.findMetaEnvelopeById(id, context.eName);
                    },
                ),
                findMetaEnvelopesByOntology: this.accessGuard.middleware(
                    (
                        _: any,
                        { ontology }: { ontology: string },
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        return this.db.findMetaEnvelopesByOntology(
                            ontology,
                            context.eName,
                        );
                    },
                ),
                searchMetaEnvelopes: this.accessGuard.middleware(
                    (
                        _: any,
                        { ontology, term }: { ontology: string; term: string },
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        return this.db.findMetaEnvelopesBySearchTerm(
                            ontology,
                            term,
                            context.eName,
                        );
                    },
                ),
                getAllEnvelopes: this.accessGuard.middleware(
                    (_: any, __: any, context: VaultContext) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        return this.db.getAllEnvelopes(context.eName);
                    },
                ),
            },

            Mutation: {
                // ============================================================
                // NEW IDIOMATIC API
                // ============================================================

                // Create a new MetaEnvelope with structured payload
                createMetaEnvelope: this.accessGuard.middleware(
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
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            return {
                                metaEnvelope: null,
                                errors: [
                                    {
                                        message: "X-ENAME header is required",
                                        code: "MISSING_ENAME",
                                    },
                                ],
                            };
                        }

                        try {
                            const result = await this.db.storeMetaEnvelope(
                                {
                                    ontology: input.ontology,
                                    payload: input.payload,
                                    acl: input.acl,
                                },
                                input.acl,
                                context.eName,
                            );

                            // Build the full metaEnvelope response
                            const metaEnvelope = {
                                id: result.metaEnvelope.id,
                                ontology: result.metaEnvelope.ontology,
                                envelopes: result.envelopes,
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

                            // Delayed webhook delivery to prevent ping-pong
                            setTimeout(() => {
                                this.deliverWebhooks(
                                    requestingPlatform,
                                    webhookPayload,
                                );
                            }, 3_000);

                            // Log envelope operation best-effort
                            const platform =
                                context.tokenPayload?.platform ?? null;
                            const envelopeHash = computeEnvelopeHash({
                                id: result.metaEnvelope.id,
                                ontology: input.ontology,
                                payload: input.payload,
                            });
                            this.db
                                .appendEnvelopeOperationLog({
                                    eName: context.eName,
                                    metaEnvelopeId: result.metaEnvelope.id,
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
                                metaEnvelope,
                                errors: [],
                            };
                        } catch (error) {
                            console.error(
                                "Error in createMetaEnvelope:",
                                error,
                            );
                            return {
                                metaEnvelope: null,
                                errors: [
                                    {
                                        message:
                                            error instanceof Error
                                                ? error.message
                                                : "Failed to create MetaEnvelope",
                                        code: "CREATE_FAILED",
                                    },
                                ],
                            };
                        }
                    },
                ),

                // Update an existing MetaEnvelope with structured payload
                updateMetaEnvelope: this.accessGuard.middleware(
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
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            return {
                                metaEnvelope: null,
                                errors: [
                                    {
                                        message: "X-ENAME header is required",
                                        code: "MISSING_ENAME",
                                    },
                                ],
                            };
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
                                context.eName,
                            );

                            // Build the full metaEnvelope response
                            const metaEnvelope = {
                                id: result.metaEnvelope.id,
                                ontology: result.metaEnvelope.ontology,
                                envelopes: result.envelopes,
                                parsed: input.payload,
                            };

                            // Deliver webhooks for update operation
                            const requestingPlatform =
                                context.tokenPayload?.platform || null;
                            const webhookPayload = {
                                id,
                                w3id: context.eName,
                                evaultPublicKey: this.evaultPublicKey,
                                data: input.payload,
                                schemaId: input.ontology,
                            };

                            // Fire and forget webhook delivery
                            this.deliverWebhooks(
                                requestingPlatform,
                                webhookPayload,
                            );

                            // Log envelope operation best-effort
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

                            return {
                                metaEnvelope,
                                errors: [],
                            };
                        } catch (error) {
                            console.error(
                                "Error in updateMetaEnvelope:",
                                error,
                            );
                            return {
                                metaEnvelope: null,
                                errors: [
                                    {
                                        message:
                                            error instanceof Error
                                                ? error.message
                                                : "Failed to update MetaEnvelope",
                                        code: "UPDATE_FAILED",
                                    },
                                ],
                            };
                        }
                    },
                ),

                // Delete a MetaEnvelope with structured result
                removeMetaEnvelope: this.accessGuard.middleware(
                    async (
                        _: any,
                        { id }: { id: string },
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            return {
                                deletedId: id,
                                success: false,
                                errors: [
                                    {
                                        message: "X-ENAME header is required",
                                        code: "MISSING_ENAME",
                                    },
                                ],
                            };
                        }

                        try {
                            const meta = await this.db.findMetaEnvelopeById(
                                id,
                                context.eName,
                            );
                            if (!meta) {
                                return {
                                    deletedId: id,
                                    success: false,
                                    errors: [
                                        {
                                            message: "MetaEnvelope not found",
                                            code: "NOT_FOUND",
                                        },
                                    ],
                                };
                            }

                            await this.db.deleteMetaEnvelope(id, context.eName);

                            // Log after delete succeeds, best-effort
                            const platform =
                                context.tokenPayload?.platform ?? null;
                            const envelopeHash =
                                computeEnvelopeHashForDelete(id);
                            this.db
                                .appendEnvelopeOperationLog({
                                    eName: context.eName,
                                    metaEnvelopeId: id,
                                    envelopeHash,
                                    operation: "delete",
                                    platform,
                                    timestamp: new Date().toISOString(),
                                    ontology: meta.ontology,
                                })
                                .catch((err) =>
                                    console.error(
                                        "appendEnvelopeOperationLog (delete) failed:",
                                        err,
                                    ),
                                );

                            return {
                                deletedId: id,
                                success: true,
                                errors: [],
                            };
                        } catch (error) {
                            console.error(
                                "Error in removeMetaEnvelope:",
                                error,
                            );
                            return {
                                deletedId: id,
                                success: false,
                                errors: [
                                    {
                                        message:
                                            error instanceof Error
                                                ? error.message
                                                : "Failed to delete MetaEnvelope",
                                        code: "DELETE_FAILED",
                                    },
                                ],
                            };
                        }
                    },
                ),

                // Bulk create MetaEnvelopes (optimized for migrations)
                bulkCreateMetaEnvelopes: this.accessGuard.middleware(
                    async (
                        _: any,
                        {
                            inputs,
                            skipWebhooks,
                        }: {
                            inputs: Array<{
                                id?: string;
                                ontology: string;
                                payload: any;
                                acl: string[];
                            }>;
                            skipWebhooks?: boolean;
                        },
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            return {
                                results: [],
                                successCount: 0,
                                errorCount: inputs.length,
                                errors: [
                                    {
                                        message: "X-ENAME header is required",
                                        code: "MISSING_ENAME",
                                    },
                                ],
                            };
                        }

                        // Check if this is an authorized migration (emover platform with skipWebhooks)
                        const isEmoverMigration =
                            skipWebhooks &&
                            context.tokenPayload?.platform ===
                                process.env.EMOVER_API_URL;

                        // Only allow webhook skipping for authorized migration platforms
                        const shouldSkipWebhooks = isEmoverMigration;

                        const results: Array<{
                            id: string;
                            success: boolean;
                            error?: string;
                        }> = [];
                        let successCount = 0;
                        let errorCount = 0;

                        for (const input of inputs) {
                            try {
                                const result =
                                    await this.db.storeMetaEnvelopeWithId(
                                        {
                                            ontology: input.ontology,
                                            payload: input.payload,
                                            acl: input.acl,
                                        },
                                        input.acl,
                                        context.eName,
                                        input.id, // Preserve ID if provided
                                    );

                                results.push({
                                    id: result.metaEnvelope.id,
                                    success: true,
                                });
                                successCount++;

                                // Deliver webhooks if not skipping
                                if (!shouldSkipWebhooks) {
                                    const requestingPlatform =
                                        context.tokenPayload?.platform || null;
                                    const webhookPayload = {
                                        id: result.metaEnvelope.id,
                                        w3id: context.eName,
                                        evaultPublicKey: this.evaultPublicKey,
                                        data: input.payload,
                                        schemaId: input.ontology,
                                    };

                                    // Fire and forget webhook delivery
                                    this.deliverWebhooks(
                                        requestingPlatform,
                                        webhookPayload,
                                    ).catch((err) =>
                                        console.error(
                                            "Webhook delivery failed in bulk create:",
                                            err,
                                        ),
                                    );
                                }

                                // Log envelope operation best-effort
                                const platform =
                                    context.tokenPayload?.platform ?? null;
                                const envelopeHash = computeEnvelopeHash({
                                    id: result.metaEnvelope.id,
                                    ontology: input.ontology,
                                    payload: input.payload,
                                });
                                this.db
                                    .appendEnvelopeOperationLog({
                                        eName: context.eName,
                                        metaEnvelopeId: result.metaEnvelope.id,
                                        envelopeHash,
                                        operation: "create",
                                        platform,
                                        timestamp: new Date().toISOString(),
                                        ontology: input.ontology,
                                    })
                                    .catch((err) =>
                                        console.error(
                                            "appendEnvelopeOperationLog (bulk create) failed:",
                                            err,
                                        ),
                                    );
                            } catch (error) {
                                const errorMessage =
                                    error instanceof Error
                                        ? error.message
                                        : "Failed to create MetaEnvelope";
                                results.push({
                                    id: input.id || "unknown",
                                    success: false,
                                    error: errorMessage,
                                });
                                errorCount++;
                                console.error(
                                    `Error creating envelope in bulk: ${errorMessage}`,
                                );
                            }
                        }

                        return {
                            results,
                            successCount,
                            errorCount,
                            errors: [],
                        };
                    },
                ),

                // ============================================================
                // Binding Document Mutations
                // ============================================================

                createBindingDocument: this.accessGuard.middleware(
                    async (
                        _: any,
                        {
                            input,
                        }: {
                            input: {
                                subject: string;
                                type: string;
                                data: any;
                                ownerSignature: {
                                    signer: string;
                                    signature: string;
                                    timestamp: string;
                                };
                            };
                        },
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            return {
                                bindingDocument: null,
                                metaEnvelopeId: null,
                                errors: [
                                    {
                                        message: "X-ENAME header is required",
                                        code: "MISSING_ENAME",
                                    },
                                ],
                            };
                        }

                        try {
                            const result =
                                await this.bindingDocumentService.createBindingDocument(
                                    {
                                        subject: input.subject,
                                        type: input.type as any,
                                        data: input.data,
                                        ownerSignature: input.ownerSignature,
                                    },
                                    context.eName,
                                );

                            return {
                                bindingDocument: result.bindingDocument,
                                metaEnvelopeId: result.id,
                                errors: [],
                            };
                        } catch (error) {
                            console.error(
                                "Error in createBindingDocument:",
                                error,
                            );
                            return {
                                bindingDocument: null,
                                metaEnvelopeId: null,
                                errors: [
                                    {
                                        message:
                                            error instanceof Error
                                                ? error.message
                                                : "Failed to create binding document",
                                        code: "CREATE_FAILED",
                                    },
                                ],
                            };
                        }
                    },
                ),

                createBindingDocumentSignature: this.accessGuard.middleware(
                    async (
                        _: any,
                        {
                            input,
                        }: {
                            input: {
                                bindingDocumentId: string;
                                signature: {
                                    signer: string;
                                    signature: string;
                                    timestamp: string;
                                };
                            };
                        },
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            return {
                                bindingDocument: null,
                                errors: [
                                    {
                                        message: "X-ENAME header is required",
                                        code: "MISSING_ENAME",
                                    },
                                ],
                            };
                        }

                        try {
                            const result =
                                await this.bindingDocumentService.addCounterpartySignature(
                                    {
                                        metaEnvelopeId: input.bindingDocumentId,
                                        signature: input.signature,
                                    },
                                    context.eName,
                                );

                            return {
                                bindingDocument: result,
                                errors: [],
                            };
                        } catch (error) {
                            console.error(
                                "Error in createBindingDocumentSignature:",
                                error,
                            );
                            return {
                                bindingDocument: null,
                                errors: [
                                    {
                                        message:
                                            error instanceof Error
                                                ? error.message
                                                : "Failed to add signature",
                                        code: "ADD_SIGNATURE_FAILED",
                                    },
                                ],
                            };
                        }
                    },
                ),

                // ============================================================
                // LEGACY API (preserved for backward compatibility)
                // ============================================================

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
                        context: VaultContext,
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
                            context.eName,
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
                                webhookPayload,
                            );
                        }, 3_000);

                        // Log envelope operation best-effort (do not fail mutation)
                        const platform = context.tokenPayload?.platform ?? null;
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
                    },
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
                        context: VaultContext,
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
                                context.eName,
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
                                webhookPayload,
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
                                error,
                            );
                            throw error;
                        }
                    },
                ),
                deleteMetaEnvelope: this.accessGuard.middleware(
                    async (
                        _: any,
                        { id }: { id: string },
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            throw new Error("X-ENAME header is required");
                        }
                        const meta = await this.db.findMetaEnvelopeById(
                            id,
                            context.eName,
                        );
                        await this.db.deleteMetaEnvelope(id, context.eName);
                        // Log after delete succeeds, best-effort
                        const platform = context.tokenPayload?.platform ?? null;
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
                    },
                ),
                updateEnvelopeValue: this.accessGuard.middleware(
                    async (
                        _: any,
                        {
                            envelopeId,
                            newValue,
                        }: { envelopeId: string; newValue: any },
                        context: VaultContext,
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
                    },
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
                const eName =
                    request.headers.get("x-ename") ??
                    request.headers.get("X-ENAME") ??
                    null;

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
