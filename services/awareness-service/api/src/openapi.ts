/**
 * OpenAPI 3.1 description of the Awareness as a Service API. Served raw at
 * GET /openapi.json and rendered as interactive docs (Scalar) at GET /docs.
 */
export const openApiDocument = {
    openapi: "3.1.0",
    info: {
        title: "Awareness as a Service API",
        version: "1.0.0",
        description:
            "AaaS is the single fanout point for MetaEnvelope awareness " +
            "packets. evault-core POSTs every change to `/ingest`; AaaS " +
            "persists it, lets approved consumers poll history and register " +
            "webhook subscriptions filtered by ontology and eVault, and " +
            "delivers webhooks with retry + dead-lettering.\n\n" +
            "## Authentication\n" +
            "- **Ingest** (`/ingest`): the `x-ingest-secret` header, shared " +
            "with evault-core.\n" +
            "- **Consumer API** (`/api/packets`, `/api/subscriptions`, " +
            "`/api/me/*`): `Authorization: Bearer <token>` where the token is " +
            "either an issued API key (`aaas_...`) or a W3DS portal session " +
            "JWT.\n" +
            "- **Portal** (`/api/applications/*`): a W3DS portal session JWT.\n" +
            "- **Admin** (`/api/admin/*`): a W3DS portal session JWT whose " +
            "eName is in `AAAS_ADMIN_ENAMES`.",
    },
    servers: [{ url: "/", description: "This AaaS instance" }],
    tags: [
        { name: "Ingest", description: "Awareness packet ingestion from evault-core" },
        { name: "Query", description: "Polling the awareness packet history" },
        { name: "Subscriptions", description: "Dynamic webhook subscriptions" },
        { name: "Consumer", description: "Consumer self-service" },
        { name: "Auth", description: "W3DS portal login" },
        { name: "Applications", description: "Access applications" },
        { name: "Admin", description: "Application review and dead-letters" },
        { name: "System", description: "Health and service metadata" },
    ],
    components: {
        securitySchemes: {
            ingestSecret: {
                type: "apiKey",
                in: "header",
                name: "x-ingest-secret",
                description: "Shared secret presented by evault-core.",
            },
            consumerAuth: {
                type: "http",
                scheme: "bearer",
                description:
                    "An issued API key (`aaas_...`) or a W3DS portal session JWT.",
            },
            portalAuth: {
                type: "http",
                scheme: "bearer",
                description: "A W3DS portal session JWT.",
            },
        },
        schemas: {
            Error: {
                type: "object",
                properties: { error: { type: "string" } },
                required: ["error"],
            },
            AwarenessPayload: {
                type: "object",
                description:
                    "The packet evault-core POSTs to /ingest and the body " +
                    "delivered to webhook subscribers.",
                properties: {
                    id: { type: "string", description: "MetaEnvelope id" },
                    w3id: {
                        type: "string",
                        nullable: true,
                        description: "Owner's W3ID (eName)",
                    },
                    evaultPublicKey: { type: "string", nullable: true },
                    data: {
                        type: "object",
                        nullable: true,
                        additionalProperties: true,
                    },
                    schemaId: {
                        type: "string",
                        description: "The MetaEnvelope ontology",
                    },
                    operation: {
                        type: "string",
                        enum: ["create", "update", "delete"],
                    },
                    requestingPlatform: {
                        type: "string",
                        nullable: true,
                        description:
                            "Origin platform; used to skip ping-pong delivery. " +
                            "Never persisted or delivered.",
                    },
                },
                required: ["id", "schemaId"],
            },
            Packet: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    ontology: { type: "string" },
                    evaultPublicKey: { type: "string", nullable: true },
                    w3id: { type: "string", nullable: true },
                    data: { type: "object", nullable: true, additionalProperties: true },
                    operation: { type: "string", enum: ["create", "update", "delete"] },
                    receivedAt: { type: "string", format: "date-time" },
                },
            },
            Subscription: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    consumerId: { type: "string", format: "uuid" },
                    targetUrl: { type: "string" },
                    ontologyFilter: {
                        type: "array",
                        items: { type: "string" },
                        description: "Empty = all ontologies",
                    },
                    evaultFilter: {
                        type: "array",
                        items: { type: "string" },
                        description: "Empty = all eVaults",
                    },
                    isCatchAll: { type: "boolean" },
                    active: { type: "boolean" },
                    secret: { type: "string", nullable: true },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            SubscriptionInput: {
                type: "object",
                properties: {
                    targetUrl: {
                        type: "string",
                        description:
                            "Defaults to `<consumer.webhookBaseUrl>/api/webhook`",
                    },
                    ontologyFilter: { type: "array", items: { type: "string" } },
                    evaultFilter: { type: "array", items: { type: "string" } },
                    secret: {
                        type: "string",
                        description:
                            "If set, deliveries carry an `x-aaas-signature` HMAC header",
                    },
                },
            },
            Delivery: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    subscriptionId: { type: "string", format: "uuid" },
                    packetId: { type: "string" },
                    status: {
                        type: "string",
                        enum: ["pending", "delivering", "delivered", "failed"],
                    },
                    attempts: { type: "integer" },
                    nextAttemptAt: { type: "string", format: "date-time" },
                    lastError: { type: "string", nullable: true },
                    lastResponseStatus: { type: "integer", nullable: true },
                    deliveredAt: { type: "string", format: "date-time", nullable: true },
                },
            },
            DeadLetter: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    deliveryId: { type: "string", format: "uuid" },
                    subscriptionId: { type: "string", format: "uuid" },
                    packetId: { type: "string" },
                    consumerId: { type: "string", format: "uuid" },
                    payload: { type: "object", additionalProperties: true },
                    targetUrl: { type: "string" },
                    totalAttempts: { type: "integer" },
                    lastError: { type: "string", nullable: true },
                    lastResponseStatus: { type: "integer", nullable: true },
                    resolved: { type: "boolean" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            Consumer: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    ename: { type: "string" },
                    name: { type: "string", nullable: true },
                    status: {
                        type: "string",
                        enum: ["pending", "approved", "rejected", "revoked"],
                    },
                    webhookBaseUrl: { type: "string", nullable: true },
                },
            },
            AccessApplication: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    consumerId: { type: "string", format: "uuid" },
                    justification: { type: "string", nullable: true },
                    requestedOntologies: { type: "array", items: { type: "string" } },
                    status: {
                        type: "string",
                        enum: ["pending", "approved", "rejected"],
                    },
                    reviewedByEname: { type: "string", nullable: true },
                    reviewNote: { type: "string", nullable: true },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
        },
    },
    paths: {
        "/health": {
            get: {
                tags: ["System"],
                summary: "Liveness check",
                responses: {
                    "200": {
                        description: "Service is up",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        status: { type: "string" },
                                        service: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/ingest": {
            post: {
                tags: ["Ingest"],
                summary: "Ingest an awareness packet",
                description:
                    "The single sink evault-core POSTs every MetaEnvelope " +
                    "change to. Upserts the packet and queues a delivery per " +
                    "matching subscription.",
                security: [{ ingestSecret: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/AwarenessPayload" },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Packet stored and deliveries queued",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        ok: { type: "boolean" },
                                        packetId: { type: "string" },
                                        deliveriesQueued: { type: "integer" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { $ref: "#/components/responses/BadRequest" },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                },
            },
        },
        "/api/packets": {
            get: {
                tags: ["Query"],
                summary: "Poll awareness packet history",
                description:
                    "Filter the packet history by ontology, eVault and time " +
                    "range, paged with an opaque cursor.",
                security: [{ consumerAuth: [] }],
                parameters: [
                    {
                        name: "ontology",
                        in: "query",
                        schema: { type: "string" },
                        description: "Comma-separated list of ontologies",
                    },
                    {
                        name: "evault",
                        in: "query",
                        schema: { type: "string" },
                        description: "Match w3id or evaultPublicKey",
                    },
                    {
                        name: "from",
                        in: "query",
                        schema: { type: "string", format: "date-time" },
                    },
                    {
                        name: "to",
                        in: "query",
                        schema: { type: "string", format: "date-time" },
                    },
                    {
                        name: "limit",
                        in: "query",
                        schema: { type: "integer", default: 100, maximum: 500 },
                    },
                    {
                        name: "cursor",
                        in: "query",
                        schema: { type: "string" },
                        description: "nextCursor from a previous response",
                    },
                ],
                responses: {
                    "200": {
                        description: "A page of packets",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        packets: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Packet" },
                                        },
                                        hasMore: { type: "boolean" },
                                        nextCursor: { type: "string", nullable: true },
                                    },
                                },
                            },
                        },
                    },
                    "400": { $ref: "#/components/responses/BadRequest" },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "403": { $ref: "#/components/responses/Forbidden" },
                },
            },
        },
        "/api/subscriptions": {
            get: {
                tags: ["Subscriptions"],
                summary: "List your subscriptions",
                security: [{ consumerAuth: [] }],
                responses: {
                    "200": {
                        description: "Your subscriptions",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        subscriptions: {
                                            type: "array",
                                            items: {
                                                $ref: "#/components/schemas/Subscription",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                },
            },
            post: {
                tags: ["Subscriptions"],
                summary: "Register a webhook subscription",
                security: [{ consumerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/SubscriptionInput" },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Subscription created",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        subscription: {
                                            $ref: "#/components/schemas/Subscription",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "400": { $ref: "#/components/responses/BadRequest" },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                },
            },
        },
        "/api/subscriptions/{id}": {
            patch: {
                tags: ["Subscriptions"],
                summary: "Update a subscription",
                security: [{ consumerAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string", format: "uuid" },
                    },
                ],
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    { $ref: "#/components/schemas/SubscriptionInput" },
                                    {
                                        type: "object",
                                        properties: { active: { type: "boolean" } },
                                    },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Updated subscription",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        subscription: {
                                            $ref: "#/components/schemas/Subscription",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            },
            delete: {
                tags: ["Subscriptions"],
                summary: "Disable a subscription",
                description: "Soft delete - sets the subscription inactive.",
                security: [{ consumerAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string", format: "uuid" },
                    },
                ],
                responses: {
                    "200": { $ref: "#/components/responses/Ok" },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            },
        },
        "/api/me": {
            get: {
                tags: ["Consumer"],
                summary: "Your consumer profile",
                security: [{ consumerAuth: [] }],
                responses: {
                    "200": {
                        description: "Consumer profile",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/Consumer" },
                            },
                        },
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                },
            },
        },
        "/api/me/api-keys": {
            get: {
                tags: ["Consumer"],
                summary: "List your API keys",
                security: [{ consumerAuth: [] }],
                responses: {
                    "200": {
                        description: "API key metadata (never the plaintext)",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        apiKeys: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    keyPrefix: { type: "string" },
                                                    revoked: { type: "boolean" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ["Consumer"],
                summary: "Issue a new API key",
                description:
                    "Returns the plaintext key exactly once - it cannot be " +
                    "retrieved again.",
                security: [{ consumerAuth: [] }],
                responses: {
                    "201": {
                        description: "New API key",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        keyPrefix: { type: "string" },
                                        apiKey: {
                                            type: "string",
                                            description: "Plaintext, shown once",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/api/me/api-keys/{id}": {
            delete: {
                tags: ["Consumer"],
                summary: "Revoke an API key",
                security: [{ consumerAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string", format: "uuid" },
                    },
                ],
                responses: {
                    "200": { $ref: "#/components/responses/Ok" },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            },
        },
        "/api/me/deliveries": {
            get: {
                tags: ["Consumer"],
                summary: "Recent webhook deliveries",
                security: [{ consumerAuth: [] }],
                parameters: [
                    {
                        name: "limit",
                        in: "query",
                        schema: { type: "integer", default: 50, maximum: 200 },
                    },
                ],
                responses: {
                    "200": {
                        description: "Recent deliveries across your subscriptions",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        deliveries: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Delivery" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/api/auth/offer": {
            post: {
                tags: ["Auth"],
                summary: "Start a W3DS login",
                description: "Returns a `w3ds://auth` deeplink and a session id.",
                responses: {
                    "200": {
                        description: "Auth offer",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        uri: { type: "string" },
                                        session: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/api/auth": {
            post: {
                tags: ["Auth"],
                summary: "W3DS wallet callback",
                description:
                    "Called by the eID wallet to submit the signature over " +
                    "the session id.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    w3id: { type: "string" },
                                    session: { type: "string" },
                                    signature: { type: "string" },
                                },
                                required: ["w3id", "session", "signature"],
                            },
                        },
                    },
                },
                responses: {
                    "200": { $ref: "#/components/responses/Ok" },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                },
            },
        },
        "/api/auth/session/{session}": {
            get: {
                tags: ["Auth"],
                summary: "Poll a login session",
                description:
                    "The portal polls this until the wallet has signed in, " +
                    "then receives the session JWT.",
                parameters: [
                    {
                        name: "session",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                    },
                ],
                responses: {
                    "200": {
                        description: "Session status",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        status: {
                                            type: "string",
                                            enum: ["pending", "authenticated"],
                                        },
                                        token: {
                                            type: "string",
                                            description: "Present once authenticated",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/api/applications/me": {
            get: {
                tags: ["Applications"],
                summary: "Your application status",
                security: [{ portalAuth: [] }],
                responses: {
                    "200": {
                        description: "Your consumer and latest application",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        consumer: {
                                            $ref: "#/components/schemas/Consumer",
                                        },
                                        application: {
                                            $ref: "#/components/schemas/AccessApplication",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                },
            },
        },
        "/api/applications": {
            post: {
                tags: ["Applications"],
                summary: "Apply for access",
                security: [{ portalAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    contactEmail: { type: "string" },
                                    webhookBaseUrl: { type: "string" },
                                    justification: { type: "string" },
                                    requestedOntologies: {
                                        type: "array",
                                        items: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Application submitted",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        consumer: {
                                            $ref: "#/components/schemas/Consumer",
                                        },
                                        application: {
                                            $ref: "#/components/schemas/AccessApplication",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "409": {
                        description: "Consumer is already approved",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/Error" },
                            },
                        },
                    },
                },
            },
        },
        "/api/admin/applications": {
            get: {
                tags: ["Admin"],
                summary: "List access applications",
                security: [{ portalAuth: [] }],
                parameters: [
                    {
                        name: "status",
                        in: "query",
                        schema: {
                            type: "string",
                            enum: ["pending", "approved", "rejected", "all"],
                            default: "pending",
                        },
                    },
                ],
                responses: {
                    "200": {
                        description: "Applications with consumer details",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        applications: {
                                            type: "array",
                                            items: {
                                                $ref: "#/components/schemas/AccessApplication",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "403": { $ref: "#/components/responses/Forbidden" },
                },
            },
        },
        "/api/admin/applications/{id}/approve": {
            post: {
                tags: ["Admin"],
                summary: "Approve an application",
                security: [{ portalAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string", format: "uuid" },
                    },
                ],
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: { note: { type: "string" } },
                            },
                        },
                    },
                },
                responses: {
                    "200": { $ref: "#/components/responses/Ok" },
                    "403": { $ref: "#/components/responses/Forbidden" },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            },
        },
        "/api/admin/applications/{id}/reject": {
            post: {
                tags: ["Admin"],
                summary: "Reject an application",
                security: [{ portalAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string", format: "uuid" },
                    },
                ],
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: { note: { type: "string" } },
                            },
                        },
                    },
                },
                responses: {
                    "200": { $ref: "#/components/responses/Ok" },
                    "403": { $ref: "#/components/responses/Forbidden" },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            },
        },
        "/api/admin/dead-letters": {
            get: {
                tags: ["Admin"],
                summary: "List dead-lettered deliveries",
                security: [{ portalAuth: [] }],
                parameters: [
                    {
                        name: "resolved",
                        in: "query",
                        schema: { type: "boolean", default: false },
                        description: "Include already-resolved dead letters",
                    },
                ],
                responses: {
                    "200": {
                        description: "Dead letters",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        deadLetters: {
                                            type: "array",
                                            items: {
                                                $ref: "#/components/schemas/DeadLetter",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "403": { $ref: "#/components/responses/Forbidden" },
                },
            },
        },
        "/api/admin/dead-letters/{id}/replay": {
            post: {
                tags: ["Admin"],
                summary: "Replay a dead-lettered delivery",
                description:
                    "Re-queues the original delivery and marks the dead " +
                    "letter resolved.",
                security: [{ portalAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string", format: "uuid" },
                    },
                ],
                responses: {
                    "200": { $ref: "#/components/responses/Ok" },
                    "403": { $ref: "#/components/responses/Forbidden" },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            },
        },
    },
} as const;

// Reusable responses are attached after the fact to keep the paths readable.
(openApiDocument as any).components.responses = {
    Ok: {
        description: "Success",
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    properties: { ok: { type: "boolean" } },
                },
            },
        },
    },
    BadRequest: {
        description: "Invalid request",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
            },
        },
    },
    Unauthorized: {
        description: "Missing or invalid credentials",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
            },
        },
    },
    Forbidden: {
        description: "Authenticated but not permitted",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
            },
        },
    },
    NotFound: {
        description: "Resource not found",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
            },
        },
    },
};
