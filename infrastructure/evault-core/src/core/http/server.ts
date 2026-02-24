import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import axios from "axios";
import fastify, { type FastifyInstance } from "fastify";
import * as jose from "jose";
import type {
    ProvisionRequest,
    ProvisioningService,
} from "../../services/ProvisioningService";
import { DbService } from "../db/db.service";
import { ProtectedZoneService } from "../db/protected-zone.service";
import { connectWithRetry } from "../db/retry-neo4j";
import { validatePassphraseStrength } from "../utils/passphrase";
import { getProvisionerJwk } from "../utils/provisioner-signer";
import {
    checkRateLimit,
    recordAttempt,
} from "./passphrase-rate-limiter";
import { type TypedReply, type TypedRequest, WatcherRequest } from "./types";

interface WatcherSignatureRequest {
    w3id: string;
    logEntryId: string;
    proof: {
        signature: string;
        alg: string;
        kid: string;
    };
}

export async function registerHttpRoutes(
    server: FastifyInstance,
    evault: any, // EVault instance to access publicKey
    provisioningService?: ProvisioningService,
    dbService?: DbService,
    protectedZoneService?: ProtectedZoneService,
): Promise<void> {
    // Register Swagger
    await server.register(swagger, {
        swagger: {
            info: {
                title: "eVault Core API",
                description: "API documentation for eVault Core HTTP endpoints",
                version: "1.0.0",
            },
            tags: [
                { name: "identity", description: "Identity related endpoints" },
                { name: "logs", description: "Envelope operation logs" },
                {
                    name: "watchers",
                    description: "Watcher signature related endpoints",
                },
                {
                    name: "provisioning",
                    description: "eVault provisioning endpoints",
                },
            ],
        },
    });

    await server.register(swaggerUi, {
        routePrefix: "/docs",
    });

    // Provisioner JWKs endpoint — exposes the provisioner's ed25519 public key
    server.get(
        "/.well-known/jwks.json",
        {
            schema: {
                tags: ["identity"],
                description: "JWK Set containing the provisioner's public signing key",
                response: {
                    200: {
                        type: "object",
                        properties: {
                            keys: { type: "array", items: { type: "object" } },
                        },
                    },
                },
            },
        },
        async (_request, _reply) => {
            try {
                const jwk = getProvisionerJwk();
                return { keys: [jwk] };
            } catch {
                return { keys: [] };
            }
        },
    );

    // Whois endpoint - returns both W3ID identifier and public key
    server.get(
        "/whois",
        {
            schema: {
                tags: ["identity"],
                description: "Get eVault W3ID identifier and public key",
                headers: {
                    type: "object",
                    required: ["X-ENAME"],
                    properties: {
                        "X-ENAME": { type: "string" },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            w3id: { type: "string" },
                            evaultId: { type: ["string", "null"] },
                            keyBindingCertificates: {
                                type: "array",
                                items: { type: "string" },
                            },
                        },
                    },
                    400: {
                        type: "object",
                        properties: {
                            error: { type: "string" },
                        },
                    },
                },
            },
        },
        async (request: TypedRequest<{}>, reply: TypedReply) => {
            const eName =
                request.headers["x-ename"] || request.headers["X-ENAME"];

            if (!eName || typeof eName !== "string") {
                return reply
                    .status(400)
                    .send({ error: "X-ENAME header is required" });
            }

            // Get public keys from database if dbService is available
            let publicKeys: string[] = [];
            if (dbService) {
                try {
                    publicKeys = await dbService.getPublicKeys(eName);
                } catch (error) {
                    console.error(
                        "Error getting public keys from database:",
                        error,
                    );
                    // Continue with empty array
                }
            }

            // Generate key binding certificates for each public key
            const keyBindingCertificates: string[] = [];
            const registryUrl =
                process.env.PUBLIC_REGISTRY_URL || process.env.REGISTRY_URL;
            const sharedSecret = process.env.REGISTRY_SHARED_SECRET;

            if (registryUrl && sharedSecret && publicKeys.length > 0) {
                try {
                    for (const publicKey of publicKeys) {
                        try {
                            const response = await axios.post(
                                new URL(
                                    "/key-binding-certificate",
                                    registryUrl,
                                ).toString(),
                                {
                                    ename: eName,
                                    publicKey: publicKey,
                                },
                                {
                                    headers: {
                                        Authorization: `Bearer ${sharedSecret}`,
                                    },
                                    timeout: 10000,
                                },
                            );
                            if (response.data?.token) {
                                keyBindingCertificates.push(
                                    response.data.token,
                                );
                            }
                        } catch (error) {
                            console.error(
                                `Error generating key binding certificate for public key:`,
                                error,
                            );
                            // Continue with other keys even if one fails
                        }
                    }
                } catch (error) {
                    console.error(
                        "Error generating key binding certificates:",
                        error,
                    );
                    // Return empty array if generation fails
                }
            }

            // Resolve eName via Registry (same logic as /resolve) to get evault id
            let evaultId: string | null = null;
            const registryUrlForResolve =
                process.env.PUBLIC_REGISTRY_URL || process.env.REGISTRY_URL;
            if (registryUrlForResolve) {
                try {
                    const resolveResponse = await axios.get<{
                        ename: string;
                        uri: string;
                        evault: string;
                        originalUri?: string;
                        resolved?: boolean;
                    }>(
                        new URL(
                            `/resolve?w3id=${encodeURIComponent(eName)}`,
                            registryUrlForResolve,
                        ).toString(),
                        { timeout: 10000 },
                    );
                    if (resolveResponse.data?.evault) {
                        evaultId = resolveResponse.data.evault;
                    }
                } catch (error) {
                    // 404 or network error: evault not registered for this eName, or registry unavailable
                    if (
                        axios.isAxiosError(error) &&
                        error.response?.status !== 404
                    ) {
                        console.error(
                            "Error resolving eName via Registry for whois evaultId:",
                            error.message,
                        );
                    }
                }
            }
            const result = {
                w3id: eName,
                evaultId,
                keyBindingCertificates: keyBindingCertificates,
            };
            return result;
        },
    );

    // Logs endpoint - paginated envelope operation logs (akin to whois)
    server.get<{
        Querystring: { limit?: string; cursor?: string };
    }>(
        "/logs",
        {
            schema: {
                tags: ["logs"],
                description:
                    "Get paginated envelope operation logs for an eName (X-ENAME required)",
                headers: {
                    type: "object",
                    required: ["X-ENAME"],
                    properties: {
                        "X-ENAME": { type: "string" },
                    },
                },
                querystring: {
                    type: "object",
                    properties: {
                        limit: {
                            type: "string",
                            description: "Page size (default 20, max 100)",
                        },
                        cursor: {
                            type: "string",
                            description: "Opaque cursor for next page",
                        },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            logs: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        eName: { type: "string" },
                                        metaEnvelopeId: { type: "string" },
                                        envelopeHash: { type: "string" },
                                        operation: { type: "string" },
                                        platform: { type: ["string", "null"] },
                                        timestamp: { type: "string" },
                                        ontology: { type: "string" },
                                    },
                                },
                            },
                            nextCursor: { type: ["string", "null"] },
                            hasMore: { type: "boolean" },
                        },
                    },
                    400: {
                        type: "object",
                        properties: {
                            error: { type: "string" },
                        },
                    },
                    500: {
                        type: "object",
                        properties: {
                            error: { type: "string" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const eName =
                request.headers["x-ename"] || request.headers["X-ENAME"];

            if (!eName || typeof eName !== "string") {
                return reply
                    .status(400)
                    .send({ error: "X-ENAME header is required" });
            }

            if (!dbService) {
                return reply
                    .status(500)
                    .send({ error: "Database service not available" });
            }

            try {
                const limit = Math.min(
                    Math.max(
                        1,
                        Number.parseInt(request.query.limit || "20", 10) || 20,
                    ),
                    100,
                );
                const cursor = request.query.cursor ?? null;
                const result = await dbService.getEnvelopeOperationLogs(eName, {
                    limit,
                    cursor,
                });
                return {
                    logs: result.logs,
                    nextCursor: result.nextCursor,
                    hasMore: result.hasMore,
                };
            } catch (error) {
                console.error("Error fetching envelope operation logs:", error);
                return reply.status(500).send({
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to fetch logs",
                });
            }
        },
    );

    // Watchers signature endpoint - DISABLED: Requires W3ID functionality
    // This endpoint is disabled because the eVault no longer creates/manages W3IDs
    // The private key is now stored on the user's phone
    /*
  server.post<{ Body: WatcherSignatureRequest }>(
    "/watchers/sign",
    {
      schema: {
        tags: ["watchers"],
        description: "Post a signature for a specific log entry",
        body: {
          type: "object",
          required: ["w3id", "logEntryId", "proof"],
          properties: {
            w3id: { type: "string" },
            logEntryId: { type: "string" },
            proof: {
              type: "object",
              required: ["signature", "alg", "kid"],
              properties: {
                signature: { type: "string" },
                alg: { type: "string" },
                kid: { type: "string" },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: TypedRequest<WatcherSignatureRequest>,
      reply: TypedReply
    ) => {
      const { w3id, logEntryId, proof } = request.body;

      try {
        const currentW3ID = await W3ID.get();
        if (!currentW3ID.logs) {
          throw new Error("W3ID must have logs enabled");
        }

        const logEvent = await currentW3ID.logs.repository.findOne({
          versionId: logEntryId,
        });
        if (!logEvent) {
          throw new Error(`Log event not found with id ${logEntryId}`);
        }

        const isValid = await verifierCallback(
          logEntryId,
          [proof],
          proof.kid.split("#")[0]
        );
        if (!isValid) {
          throw new Error("Invalid signature");
        }

        const updatedLogEvent: LogEvent = {
          ...logEvent,
          proofs: [...(logEvent.proofs || []), proof],
        };

        await currentW3ID.logs.repository.create(updatedLogEvent);

        return {
          success: true,
          message: "Signature stored successfully",
        };
      } catch (error) {
        console.error("Error storing signature:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to store signature",
          requestId: "",
        };
      }
    }
  );
  */

    // Watchers request endpoint - DISABLED: Requires W3ID functionality
    // This endpoint is disabled because the eVault no longer creates/manages W3IDs
    // The private key is now stored on the user's phone
    /*
  server.post<{ Body: WatcherRequest }>(
    "/watchers/request",
    {
      schema: {
        tags: ["watchers"],
        description: "Request signature for a log entry",
        body: {
          type: "object",
          required: ["w3id", "logEntryId"],
          properties: {
            w3id: { type: "string" },
            logEntryId: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              requestId: { type: "string" },
            },
          },
        },
      },
    },
    async (request: TypedRequest<WatcherRequest>, reply: TypedReply) => {
      const { w3id, logEntryId } = request.body;

      try {
        // Resolve the W3ID to get its request endpoint
        const registryResponse = await axios.get(
          `http://localhost:4321/resolve?w3id=${w3id}`
        );
        const { requestWatcherSignature } = registryResponse.data;

        // Get the current W3ID instance
        const currentW3ID = await W3ID.get();
        if (!currentW3ID.logs) {
          throw new Error("W3ID must have logs enabled");
        }

        // Find the log event
        const logEvent = await currentW3ID.logs.repository.findOne({
          versionId: logEntryId,
        });
        if (!logEvent) {
          throw new Error(`Log event not found with id ${logEntryId}`);
        }

        // Request signature from the watcher
        const response = await axios.post(requestWatcherSignature, {
          w3id: currentW3ID.id,
          logEntryId,
          signature: await currentW3ID.signJWT({
            sub: logEntryId,
            exp: Date.now() + 3600 * 1000, // 1 hour expiry
          }),
        });

        return {
          success: true,
          message: "Signature request created",
          requestId: response.data.requestId,
        };
      } catch (error) {
        console.error("Error requesting signature:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to request signature",
          requestId: "",
        };
      }
    }
  );
  */

    // Helper function to validate JWT token
    async function validateToken(
        authHeader: string | null,
    ): Promise<any | null> {
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.error(
                "Token validation: Missing or invalid Authorization header format",
            );
            return null;
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        try {
            // Try REGISTRY_URL first, fallback to PUBLIC_REGISTRY_URL
            const registryUrl =
                process.env.REGISTRY_URL || process.env.PUBLIC_REGISTRY_URL;
            if (!registryUrl) {
                console.error(
                    "Token validation: REGISTRY_URL or PUBLIC_REGISTRY_URL is not set",
                );
                return null;
            }

            const jwksUrl = new URL(
                "/.well-known/jwks.json",
                registryUrl,
            ).toString();
            console.log(`Token validation: Fetching JWKS from ${jwksUrl}`);

            const jwksResponse = await axios.get(jwksUrl, {
                timeout: 5000,
            });

            console.log(
                `Token validation: JWKS response keys count: ${jwksResponse.data?.keys?.length || 0}`,
            );

            const JWKS = jose.createLocalJWKSet(jwksResponse.data);

            // Decode token header to see what kid it's using
            const decodedHeader = jose.decodeProtectedHeader(token);
            console.log(
                `Token validation: Token header - alg: ${decodedHeader.alg}, kid: ${decodedHeader.kid}`,
            );

            const { payload } = await jose.jwtVerify(token, JWKS);

            console.log(
                "Token validation: Token verified successfully, payload:",
                payload,
            );
            return payload;
        } catch (error: any) {
            console.error("Token validation failed:", error.message || error);
            if (error.code) {
                console.error(`Token validation error code: ${error.code}`);
            }
            if (error.response) {
                console.error(
                    `Token validation HTTP error: ${error.response.status} - ${error.response.statusText}`,
                );
            }
            if (error.cause) {
                console.error("Token validation error cause:", error.cause);
            }
            return null;
        }
    }

    // PATCH endpoint to save public key
    server.patch<{ Body: { publicKey: string } }>(
        "/public-key",
        {
            schema: {
                tags: ["identity"],
                description: "Save public key for a user's eName",
                headers: {
                    type: "object",
                    required: ["X-ENAME", "Authorization"],
                    properties: {
                        "X-ENAME": { type: "string" },
                        Authorization: { type: "string" },
                    },
                },
                body: {
                    type: "object",
                    required: ["publicKey"],
                    properties: {
                        publicKey: { type: "string" },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            message: { type: "string" },
                        },
                    },
                    400: {
                        type: "object",
                        properties: {
                            error: { type: "string" },
                        },
                    },
                    401: {
                        type: "object",
                        properties: {
                            error: { type: "string" },
                        },
                    },
                },
            },
        },
        async (
            request: TypedRequest<{ publicKey: string }>,
            reply: TypedReply,
        ) => {
            const eName =
                request.headers["x-ename"] || request.headers["X-ENAME"];

            if (!eName || typeof eName !== "string") {
                return reply
                    .status(400)
                    .send({ error: "X-ENAME header is required" });
            }

            const authHeader =
                request.headers.authorization || request.headers.Authorization;
            const tokenPayload = await validateToken(
                typeof authHeader === "string" ? authHeader : null,
            );

            if (!tokenPayload) {
                return reply
                    .status(401)
                    .send({ error: "Invalid or missing authentication token" });
            }

            const { publicKey } = request.body;
            if (!publicKey) {
                return reply
                    .status(400)
                    .send({ error: "publicKey is required in request body" });
            }

            if (!dbService) {
                return reply
                    .status(500)
                    .send({ error: "Database service not available" });
            }

            try {
                await dbService.addPublicKey(eName, publicKey);
                return {
                    success: true,
                    message: "Public key added successfully",
                };
            } catch (error) {
                console.error("Error adding public key:", error);
                return reply.status(500).send({
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to add public key",
                });
            }
        },
    );

    // =========================================================================
    // Protected Zone — recovery passphrase endpoints
    // These endpoints operate on the ProtectedZone graph layer which is never
    // exposed via GraphQL and stores only a PBKDF2 hash, never the plain text.
    // =========================================================================

    if (protectedZoneService) {
        /**
         * POST /passphrase/set
         * Store (or replace) the recovery passphrase for the authenticated eName.
         * Requires Authorization: Bearer <token> and X-ENAME header.
         */
        server.post<{ Body: { passphrase: string } }>(
            "/passphrase/set",
            {
                schema: {
                    tags: ["identity"],
                    description: "Set or update the recovery passphrase for an eName (hash stored; plain text discarded)",
                    headers: {
                        type: "object",
                        required: ["X-ENAME", "Authorization"],
                        properties: {
                            "X-ENAME": { type: "string" },
                            Authorization: { type: "string" },
                        },
                    },
                    body: {
                        type: "object",
                        required: ["passphrase"],
                        properties: {
                            passphrase: { type: "string" },
                        },
                    },
                    response: {
                        200: {
                            type: "object",
                            properties: {
                                success: { type: "boolean" },
                                message: { type: "string" },
                            },
                        },
                        400: { type: "object", properties: { error: { type: "string" }, details: { type: "array", items: { type: "string" } } } },
                        401: { type: "object", properties: { error: { type: "string" } } },
                    },
                },
            },
            async (request: TypedRequest<{ passphrase: string }>, reply: TypedReply) => {
                const eName = request.headers["x-ename"] || request.headers["X-ENAME"];
                if (!eName || typeof eName !== "string") {
                    return reply.status(400).send({ error: "X-ENAME header is required" });
                }

                const authHeader = request.headers.authorization || request.headers.Authorization;
                const tokenPayload = await validateToken(
                    typeof authHeader === "string" ? authHeader : null,
                );
                if (!tokenPayload) {
                    return reply.status(401).send({ error: "Invalid or missing authentication token" });
                }

                const { passphrase } = request.body;
                if (!passphrase) {
                    return reply.status(400).send({ error: "passphrase is required" });
                }

                const strength = validatePassphraseStrength(passphrase);
                if (!strength.valid) {
                    return reply.status(400).send({ error: "Passphrase does not meet requirements", details: strength.errors });
                }

                try {
                    await protectedZoneService.setPassphraseHash(eName, passphrase);
                    return { success: true, message: "Recovery passphrase stored" };
                } catch (error) {
                    console.error("Error storing passphrase hash:", error);
                    return reply.status(500).send({ error: "Failed to store passphrase" });
                }
            },
        );

        /**
         * POST /passphrase/compare
         * Compare a candidate passphrase against the stored hash.
         * IP rate-limited: 5 attempts per 15-minute window with exponential backoff on failures.
         * The stored hash is NEVER returned — only a boolean match result.
         */
        server.post<{ Body: { eName: string; passphrase: string } }>(
            "/passphrase/compare",
            {
                schema: {
                    tags: ["identity"],
                    description: "Compare a recovery passphrase candidate against the stored hash (rate-limited per IP)",
                    body: {
                        type: "object",
                        required: ["eName", "passphrase"],
                        properties: {
                            eName: { type: "string" },
                            passphrase: { type: "string" },
                        },
                    },
                    response: {
                        200: {
                            type: "object",
                            properties: {
                                match: { type: "boolean" },
                                hasPassphrase: { type: "boolean" },
                            },
                        },
                        400: { type: "object", properties: { error: { type: "string" } } },
                        429: {
                            type: "object",
                            properties: {
                                error: { type: "string" },
                                retryAfterSeconds: { type: "number" },
                            },
                        },
                    },
                },
            },
            async (request: TypedRequest<{ eName: string; passphrase: string }>, reply: TypedReply) => {
                const clientIp =
                    (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
                    request.socket?.remoteAddress ??
                    "unknown";

                const rateCheck = checkRateLimit(clientIp);
                if (!rateCheck.allowed) {
                    return reply
                        .status(429)
                        .header("Retry-After", String(rateCheck.retryAfterSeconds))
                        .send({
                            error: rateCheck.reason === "backoff"
                                ? "Too many failed attempts — please wait before retrying"
                                : "Rate limit exceeded — too many attempts in this window",
                            retryAfterSeconds: rateCheck.retryAfterSeconds,
                        });
                }

                const { eName, passphrase } = request.body;
                if (!eName || !passphrase) {
                    return reply.status(400).send({ error: "eName and passphrase are required" });
                }

                try {
                    const result = await protectedZoneService.verifyPassphrase(eName, passphrase);

                    if (result === null) {
                        // No passphrase set for this eName — not a failed attempt
                        return { match: false, hasPassphrase: false };
                    }

                    recordAttempt(clientIp, result);
                    return { match: result, hasPassphrase: true };
                } catch (error) {
                    console.error("Error comparing passphrase:", error);
                    recordAttempt(clientIp, false);
                    return reply.status(500).send({ error: "Failed to compare passphrase" });
                }
            },
        );

        /**
         * GET /passphrase/status
         * Returns whether a recovery passphrase has been set for the eName.
         * Does NOT return the hash or any other sensitive data.
         */
        server.get(
            "/passphrase/status",
            {
                schema: {
                    tags: ["identity"],
                    description: "Check whether a recovery passphrase has been set for an eName",
                    headers: {
                        type: "object",
                        required: ["X-ENAME"],
                        properties: {
                            "X-ENAME": { type: "string" },
                        },
                    },
                    response: {
                        200: {
                            type: "object",
                            properties: {
                                hasPassphrase: { type: "boolean" },
                            },
                        },
                        400: { type: "object", properties: { error: { type: "string" } } },
                    },
                },
            },
            async (request: TypedRequest<{}>, reply: TypedReply) => {
                const eName = request.headers["x-ename"] || request.headers["X-ENAME"];
                if (!eName || typeof eName !== "string") {
                    return reply.status(400).send({ error: "X-ENAME header is required" });
                }
                try {
                    const hasPassphrase = await protectedZoneService.hasPassphraseHash(eName);
                    return { hasPassphrase };
                } catch (error) {
                    console.error("Error checking passphrase status:", error);
                    return reply.status(500).send({ error: "Failed to check passphrase status" });
                }
            },
        );
    }

    // Provision eVault endpoint
    if (provisioningService) {
        server.post<{ Body: ProvisionRequest }>(
            "/provision",
            {
                schema: {
                    tags: ["provisioning"],
                    description:
                        "Provision a new eVault instance (logical only, no infrastructure)",
                    body: {
                        type: "object",
                        required: [
                            "registryEntropy",
                            "namespace",
                            "verificationId",
                        ],
                        properties: {
                            registryEntropy: { type: "string" },
                            namespace: { type: "string" },
                            verificationId: { type: "string" },
                            publicKey: { type: "string" },
                        },
                    },
                    response: {
                        200: {
                            type: "object",
                            properties: {
                                success: { type: "boolean" },
                                w3id: { type: "string" },
                                uri: { type: "string" },
                                message: { type: "string" },
                                error: { type: "string" },
                            },
                        },
                    },
                },
            },
            async (
                request: TypedRequest<ProvisionRequest>,
                reply: TypedReply,
            ) => {
                const result = await provisioningService.provisionEVault(
                    request.body,
                );
                if (!result.success) {
                    return reply.status(500).send(result);
                }
                return result;
            },
        );
    }
}
