import { Server } from "http";
import axios from "axios";
import type { GraphQLSchema } from "graphql";
import { createSchema, createYoga } from "graphql-yoga";
import { getJWTHeader } from "w3id";
import { BindingDocumentService, BINDING_DOCUMENT_ONTOLOGY } from "../../services/BindingDocumentService";
import type { DbService } from "../db/db.service";
import {
    computeEnvelopeHash,
    computeEnvelopeHashForDelete,
} from "../db/envelope-hash";
import { exampleQueries } from "./examples/examples";
import { StorageService } from "../../services/StorageService";
import { buildFileUri, FILE_SCHEMA_ID } from "../utils/w3ds-uri";
import { typeDefs } from "./typedefs";
import { VaultAccessGuard, type VaultContext } from "./vault-access-guard";
import { MessageNotificationService } from "../../services/MessageNotificationService";
import { DeviceToken } from "../../entities/DeviceToken";
import { AppDataSource } from "../../config/database";

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
    private messageNotificationService: MessageNotificationService | null = null;

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

    private getMessageNotificationService(): MessageNotificationService {
        if (!this.messageNotificationService) {
            this.messageNotificationService = new MessageNotificationService(
                AppDataSource.getRepository("Verification"),
                AppDataSource.getRepository("Notification"),
                this.db,
                AppDataSource.getRepository(DeviceToken),
            );
        }
        return this.messageNotificationService;
    }

    /**
     * Forwards an awareness packet to Awareness as a Service (AaaS).
     *
     * AaaS has replaced eVault's built-in webhook fanout: instead of querying
     * the registry and POSTing to every platform here, we make a single POST
     * to AaaS, which owns subscription matching, retry/dead-letter delivery and
     * the catch-all fanout that preserves the previous behaviour.
     *
     * @param webhookPayload - The awareness packet { id, w3id, evaultPublicKey,
     *                         data, schemaId }
     * @param requestingPlatform - The platform that triggered the change, if
     *                         known. AaaS uses it to skip delivering the packet
     *                         back to its origin (prevents webhook ping-pong).
     */
    private async notifyAwareness(
        webhookPayload: any,
        requestingPlatform: string | null = null,
    ): Promise<void> {
        // One log line per dispatch — this remains the source of truth for
        // "what eVault claims it sent"; correlate against AaaS ingest logs.
        try {
            const payloadJson = JSON.stringify(webhookPayload);
            console.log(
                `[webhook] id=${webhookPayload?.id} schemaId=${webhookPayload?.schemaId} w3id=${webhookPayload?.w3id} payload=${payloadJson}`,
            );
        } catch {
            console.log(
                `[webhook] id=${webhookPayload?.id} schemaId=${webhookPayload?.schemaId} payload=<unserializable>`,
            );
        }

        if (!process.env.AWARENESS_SERVICE_URL) {
            console.log("[webhook] AWARENESS_SERVICE_URL not set, skipping");
            return;
        }

        try {
            await axios.post(
                new URL(
                    "/ingest",
                    process.env.AWARENESS_SERVICE_URL,
                ).toString(),
                { ...webhookPayload, requestingPlatform },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "x-ingest-secret":
                            process.env.AWARENESS_INGEST_SECRET ?? "",
                    },
                    timeout: 5000,
                },
            );
        } catch (error) {
            console.log("Awareness ingest delivery failed");
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
                        const VALID_BINDING_DOCUMENT_TYPES = [
                            "id_document",
                            "photograph",
                            "social_connection",
                            "self",
                        ] as const;
                        type ValidType =
                            (typeof VALID_BINDING_DOCUMENT_TYPES)[number];
                        if (
                            args.type !== undefined &&
                            !VALID_BINDING_DOCUMENT_TYPES.includes(
                                args.type as ValidType,
                            )
                        ) {
                            throw new Error(
                                `Invalid binding document type: "${args.type}". Must be one of: ${VALID_BINDING_DOCUMENT_TYPES.join(", ")}`,
                            );
                        }
                        return this.bindingDocumentService.findBindingDocuments(
                            context.eName,
                            {
                                type: args.type as ValidType | undefined,
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

                            // Build parsed from actual written envelopes, not input
                            const parsedFromEnvelopes = result.envelopes.reduce(
                                (acc: Record<string, any>, env: any) => {
                                    acc[env.ontology] = env.value;
                                    return acc;
                                },
                                {},
                            );
                            const metaEnvelope = {
                                id: result.metaEnvelope.id,
                                ontology: result.metaEnvelope.ontology,
                                envelopes: result.envelopes,
                                parsed: parsedFromEnvelopes,
                            };

                            // Forward the awareness packet for create operation
                            const webhookPayload = {
                                id: result.metaEnvelope.id,
                                w3id: context.eName,
                                evaultPublicKey: this.evaultPublicKey,
                                data: input.payload,
                                schemaId: input.ontology,
                            };

                            // Fire-and-forget ingest to AaaS
                            this.notifyAwareness(
                                webhookPayload,
                                context.tokenPayload?.platform || null,
                            );

                            // Send push notifications for new messages
                            console.log(`[NOTIF] createMetaEnvelope ontology: "${input.ontology}"`);
                            if (MessageNotificationService.isMessageSchema(input.ontology)) {
                                console.log(`[NOTIF] Message schema detected, triggering notification for envelope ${result.metaEnvelope.id}`);
                                this.getMessageNotificationService()
                                    .notifyParticipants({
                                        messageGlobalId: result.metaEnvelope.id,
                                        payload: input.payload,
                                        senderEName: context.eName,
                                        acl: input.acl,
                                    })
                                    .catch((err) =>
                                        console.error("Message notification failed:", err),
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

                            // Build parsed from actual written envelopes, not input
                            const parsedFromEnvelopes = result.envelopes.reduce(
                                (acc: Record<string, any>, env: any) => {
                                    acc[env.ontology] = env.value;
                                    return acc;
                                },
                                {},
                            );
                            const metaEnvelope = {
                                id: result.metaEnvelope.id,
                                ontology: result.metaEnvelope.ontology,
                                envelopes: result.envelopes,
                                parsed: parsedFromEnvelopes,
                            };

                            // Deliver webhooks for update operation.
                            // Use the FULL post-write state, not input.payload —
                            // input.payload is the partial diff the caller sent,
                            // and receivers overwrite their local row with
                            // whatever the webhook carries. Sending the diff
                            // would make the receiver lose every untouched
                            // field (e.g. a read-receipt update would wipe
                            // participantIds on the receiver side).
                            const webhookPayload = {
                                id,
                                w3id: context.eName,
                                evaultPublicKey: this.evaultPublicKey,
                                data: result.mergedPayload ?? input.payload,
                                schemaId: input.ontology,
                            };

                            // Fire-and-forget ingest to AaaS
                            this.notifyAwareness(
                                webhookPayload,
                                context.tokenPayload?.platform || null,
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

                                // Forward awareness packet if not skipping
                                if (!shouldSkipWebhooks) {
                                    const webhookPayload = {
                                        id: result.metaEnvelope.id,
                                        w3id: context.eName,
                                        evaultPublicKey: this.evaultPublicKey,
                                        data: input.payload,
                                        schemaId: input.ontology,
                                    };

                                    // Fire-and-forget ingest to AaaS
                                    this.notifyAwareness(
                                        webhookPayload,
                                        context.tokenPayload?.platform || null,
                                    ).catch((err) => {
                                        console.error(`[WEBHOOK] AaaS ingest failed for bulk-create envelope ${result.metaEnvelope.id}:`, err);
                                    });
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

                        const VALID_BINDING_DOCUMENT_TYPES = [
                            "id_document",
                            "photograph",
                            "social_connection",
                            "self",
                        ] as const;
                        type ValidType =
                            (typeof VALID_BINDING_DOCUMENT_TYPES)[number];
                        if (
                            !VALID_BINDING_DOCUMENT_TYPES.includes(
                                input.type as ValidType,
                            )
                        ) {
                            return {
                                bindingDocument: null,
                                metaEnvelopeId: null,
                                errors: [
                                    {
                                        message: `Invalid binding document type: "${input.type}". Must be one of: ${VALID_BINDING_DOCUMENT_TYPES.join(", ")}`,
                                        code: "INVALID_TYPE",
                                    },
                                ],
                            };
                        }

                        try {
                            const result =
                                await this.bindingDocumentService.createBindingDocument(
                                    {
                                        subject: input.subject,
                                        type: input.type as ValidType,
                                        data: input.data,
                                        ownerSignature: input.ownerSignature,
                                    },
                                    context.eName,
                                );

                            const metaEnvelopeId = result.id;
                            const platform =
                                context.tokenPayload?.platform ?? null;
                            const envelopeHash = computeEnvelopeHash({
                                id: metaEnvelopeId,
                                ontology:
                                    BINDING_DOCUMENT_ONTOLOGY,
                                payload: result.bindingDocument as unknown as Record<string, unknown>,
                            });

                            this.db
                                .appendEnvelopeOperationLog({
                                    eName: context.eName,
                                    metaEnvelopeId,
                                    envelopeHash,
                                    operation: "create",
                                    platform,
                                    timestamp: new Date().toISOString(),
                                    ontology:
                                        BINDING_DOCUMENT_ONTOLOGY,
                                })
                                .catch((err) =>
                                    console.error(
                                        "appendEnvelopeOperationLog (createBindingDocument) failed:",
                                        err,
                                    ),
                                );

                            const webhookPayload = {
                                id: metaEnvelopeId,
                                w3id: context.eName,
                                evaultPublicKey: this.evaultPublicKey,
                                data: result.bindingDocument,
                                schemaId:
                                    BINDING_DOCUMENT_ONTOLOGY,
                            };
                            this.notifyAwareness(
                                webhookPayload,
                                context.tokenPayload?.platform || null,
                            );

                            return {
                                bindingDocument: result.bindingDocument,
                                metaEnvelopeId,
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

                            const platform =
                                context.tokenPayload?.platform ?? null;
                            const envelopeHash = computeEnvelopeHash({
                                id: input.bindingDocumentId,
                                ontology:
                                    BINDING_DOCUMENT_ONTOLOGY,
                                payload: result as unknown as Record<string, unknown>,
                            });

                            this.db
                                .appendEnvelopeOperationLog({
                                    eName: context.eName,
                                    metaEnvelopeId: input.bindingDocumentId,
                                    envelopeHash,
                                    operation: "update",
                                    platform,
                                    timestamp: new Date().toISOString(),
                                    ontology:
                                        BINDING_DOCUMENT_ONTOLOGY,
                                })
                                .catch((err) =>
                                    console.error(
                                        "appendEnvelopeOperationLog (createBindingDocumentSignature) failed:",
                                        err,
                                    ),
                                );

                            const webhookPayload = {
                                id: input.bindingDocumentId,
                                w3id: context.eName,
                                evaultPublicKey: this.evaultPublicKey,
                                data: result,
                                schemaId:
                                    BINDING_DOCUMENT_ONTOLOGY,
                            };
                            this.notifyAwareness(
                                webhookPayload,
                                context.tokenPayload?.platform || null,
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

                        // Forward the awareness packet for create operation.
                        // The requesting platform is passed so AaaS can skip
                        // delivering the packet back to its origin — the same
                        // ping-pong guard the old fanout enforced here.
                        const webhookPayload = {
                            id: result.metaEnvelope.id,
                            w3id: context.eName,
                            evaultPublicKey: this.evaultPublicKey,
                            data: input.payload,
                            schemaId: input.ontology,
                        };

                        this.notifyAwareness(
                            webhookPayload,
                            context.tokenPayload?.platform || null,
                        );

                        // Send push notifications for new messages
                        console.log(`[NOTIF] storeMetaEnvelope ontology: "${input.ontology}"`);
                        if (MessageNotificationService.isMessageSchema(input.ontology)) {
                            console.log(`[NOTIF] Message schema detected in storeMetaEnvelope, triggering notification for envelope ${result.metaEnvelope.id}`);
                            this.getMessageNotificationService()
                                .notifyParticipants({
                                    messageGlobalId: result.metaEnvelope.id,
                                    payload: input.payload,
                                    senderEName: context.eName,
                                    acl: input.acl,
                                })
                                .catch((err) =>
                                    console.error("[NOTIF] Message notification failed:", err),
                                );
                        }

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
                // Upload a file to object storage and create a File meta-envelope
                uploadFile: this.accessGuard.middleware(
                    async (
                        _: any,
                        {
                            input,
                        }: {
                            input: {
                                filename: string;
                                contentType: string;
                                content: string;
                                acl: string[];
                            };
                        },
                        context: VaultContext,
                    ) => {
                        if (!context.eName) {
                            return {
                                errors: [
                                    {
                                        message: "X-ENAME header is required",
                                        code: "MISSING_ENAME",
                                    },
                                ],
                            };
                        }

                        if (!StorageService.isConfigured()) {
                            return {
                                errors: [
                                    {
                                        message:
                                            "Object storage is not configured on this eVault",
                                        code: "STORAGE_NOT_CONFIGURED",
                                    },
                                ],
                            };
                        }

                        // Accept either raw base64 or a data: URI
                        const base64 = input.content.includes(",")
                            ? input.content.slice(
                                  input.content.indexOf(",") + 1,
                              )
                            : input.content;
                        const buffer = Buffer.from(base64, "base64");

                        if (buffer.length === 0) {
                            return {
                                errors: [
                                    {
                                        field: "content",
                                        message: "File content is empty or not valid base64",
                                        code: "INVALID_CONTENT",
                                    },
                                ],
                            };
                        }

                        const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
                        if (buffer.length > MAX_FILE_BYTES) {
                            return {
                                errors: [
                                    {
                                        field: "content",
                                        message: "File exceeds the 50 MB upload limit",
                                        code: "FILE_TOO_LARGE",
                                    },
                                ],
                            };
                        }

                        try {
                            const objectId = require("uuid").v4();
                            const key = StorageService.buildKey(
                                context.eName,
                                input.filename,
                                objectId,
                            );
                            const storage = new StorageService();
                            const publicUrl = await storage.uploadObject({
                                buffer,
                                contentType: input.contentType,
                                key,
                            });

                            const payload = {
                                filename: input.filename,
                                contentType: input.contentType,
                                size: buffer.length,
                                blobKey: key,
                                publicUrl,
                                uploadedAt: new Date().toISOString(),
                            };

                            const result = await this.db.storeMetaEnvelope(
                                {
                                    ontology: FILE_SCHEMA_ID,
                                    payload,
                                    acl: input.acl,
                                },
                                input.acl,
                                context.eName,
                            );

                            return {
                                uri: buildFileUri(
                                    context.eName,
                                    result.metaEnvelope.id,
                                ),
                                metaEnvelopeId: result.metaEnvelope.id,
                                publicUrl,
                            };
                        } catch (error) {
                            console.error("uploadFile failed:", error);
                            return {
                                errors: [
                                    {
                                        message:
                                            error instanceof Error
                                                ? error.message
                                                : "Failed to upload file",
                                        code: "UPLOAD_FAILED",
                                    },
                                ],
                            };
                        }
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

                            // Deliver webhooks with the FULL post-write state.
                            // See the long comment on the new updateMetaEnvelope
                            // resolver above — sending input.payload (the
                            // partial diff) would make receivers clobber their
                            // own untouched fields.
                            const webhookPayload = {
                                id: id,
                                w3id: context.eName,
                                evaultPublicKey: this.evaultPublicKey,
                                data: result.mergedPayload ?? input.payload,
                                schemaId: input.ontology,
                            };

                            // Fire-and-forget ingest to AaaS
                            this.notifyAwareness(
                                webhookPayload,
                                context.tokenPayload?.platform || null,
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
