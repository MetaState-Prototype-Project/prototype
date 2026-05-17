/**
 * OpenAPI 3.1 description of the *consumer-facing* Awareness as a Service API.
 * Served raw at GET /openapi.json and rendered as interactive docs (Scalar) at
 * GET /docs.
 *
 * Only endpoints a consuming platform integrates against are documented here -
 * polling packet history and managing webhook subscriptions / API keys. The
 * ingest endpoint (evault-core only), the W3DS portal login, access
 * applications and the admin routes are intentionally omitted.
 */
export const openApiDocument = {
    openapi: "3.1.0",
    info: {
        title: "Awareness as a Service API",
        version: "1.0.0",
        description:
            "Consume MetaEnvelope awareness packets: poll the packet history " +
            "by ontology, eVault and time range, and register webhook " +
            "subscriptions filtered by ontology and eVault.\n\n" +
            "## Authentication\n" +
            "All endpoints use `Authorization: Bearer <token>`, where the " +
            "token is an API key (`aaas_…`) issued to your approved consumer " +
            "from the portal dashboard.",
    },
    servers: [{ url: "/", description: "This AaaS instance" }],
    tags: [
        { name: "Query", description: "Polling the awareness packet history" },
        { name: "Subscriptions", description: "Dynamic webhook subscriptions" },
        { name: "Consumer", description: "Consumer self-service" },
        { name: "System", description: "Health and service metadata" },
    ],
    components: {
        securitySchemes: {
            consumerAuth: {
                type: "http",
                scheme: "bearer",
                description: "An API key (`aaas_…`) issued to your consumer.",
            },
        },
        schemas: {
            Error: {
                type: "object",
                properties: { error: { type: "string" } },
                required: ["error"],
            },
            Packet: {
                type: "object",
                description: "A stored awareness packet.",
                properties: {
                    id: { type: "string", description: "MetaEnvelope id" },
                    ontology: { type: "string" },
                    evaultPublicKey: { type: "string", nullable: true },
                    w3id: {
                        type: "string",
                        nullable: true,
                        description: "Owner's W3ID (eName)",
                    },
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
