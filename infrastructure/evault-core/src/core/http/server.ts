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
import { connectWithRetry } from "../db/retry-neo4j";
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
                            publicKey: { type: "string", nullable: true },
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

            // Get public key from database if dbService is available
            let publicKey: string | null = null;
            if (dbService) {
                try {
                    publicKey = await dbService.getPublicKey(eName);
                } catch (error) {
                    console.error(
                        "Error getting public key from database:",
                        error,
                    );
                    // Continue with null publicKey
                }
            }

            const result = {
                w3id: eName,
                publicKey: publicKey,
            };
            console.log("Whois request:", result);
            return result;
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
                await dbService.setPublicKey(eName, publicKey);
                return {
                    success: true,
                    message: "Public key saved successfully",
                };
            } catch (error) {
                console.error("Error saving public key:", error);
                return reply.status(500).send({
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to save public key",
                });
            }
        },
    );

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
                            "publicKey",
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

    // Emover endpoint - Copy metaEnvelopes to new evault instance
    server.post<{
        Body: {
            eName: string;
            targetNeo4jUri: string;
            targetNeo4jUser: string;
            targetNeo4jPassword: string;
        };
    }>(
        "/emover",
        {
            schema: {
                tags: ["migration"],
                description:
                    "Copy all metaEnvelopes for an eName to a new evault instance",
                body: {
                    type: "object",
                    required: [
                        "eName",
                        "targetNeo4jUri",
                        "targetNeo4jUser",
                        "targetNeo4jPassword",
                    ],
                    properties: {
                        eName: { type: "string" },
                        targetNeo4jUri: { type: "string" },
                        targetNeo4jUser: { type: "string" },
                        targetNeo4jPassword: { type: "string" },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            count: { type: "number" },
                            message: { type: "string" },
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
        async (
            request: TypedRequest<{
                eName: string;
                targetNeo4jUri: string;
                targetNeo4jUser: string;
                targetNeo4jPassword: string;
            }>,
            reply: TypedReply,
        ) => {
            const {
                eName,
                targetNeo4jUri,
                targetNeo4jUser,
                targetNeo4jPassword,
            } = request.body;

            if (!dbService) {
                return reply.status(500).send({
                    error: "Database service not available",
                });
            }

            try {
                console.log(
                    `[MIGRATION] Starting migration for eName: ${eName} to target evault`,
                );

                // Step 1: Validate eName exists in current evault
                const existingMetaEnvelopes =
                    await dbService.findAllMetaEnvelopesByEName(eName);
                if (existingMetaEnvelopes.length === 0) {
                    console.log(
                        `[MIGRATION] No metaEnvelopes found for eName: ${eName}`,
                    );
                    return reply.status(400).send({
                        error: `No metaEnvelopes found for eName: ${eName}`,
                    });
                }

                console.log(
                    `[MIGRATION] Found ${existingMetaEnvelopes.length} metaEnvelopes for eName: ${eName}`,
                );

                // Step 2: Create connection to target evault's Neo4j
                console.log(
                    `[MIGRATION] Connecting to target Neo4j at: ${targetNeo4jUri}`,
                );
                const targetDriver = await connectWithRetry(
                    targetNeo4jUri,
                    targetNeo4jUser,
                    targetNeo4jPassword,
                );
                const targetDbService = new DbService(targetDriver);

                try {
                    // Step 3: Copy all metaEnvelopes to target evault
                    console.log(
                        `[MIGRATION] Copying ${existingMetaEnvelopes.length} metaEnvelopes to target evault`,
                    );
                    const copiedCount =
                        await dbService.copyMetaEnvelopesToNewEvaultInstance(
                            eName,
                            targetDbService,
                        );

                    // Step 4: Verify copy
                    console.log(
                        `[MIGRATION] Verifying copy: checking ${copiedCount} metaEnvelopes in target evault`,
                    );
                    const targetMetaEnvelopes =
                        await targetDbService.findAllMetaEnvelopesByEName(
                            eName,
                        );

                    if (
                        targetMetaEnvelopes.length !==
                        existingMetaEnvelopes.length
                    ) {
                        const error = `Copy verification failed: expected ${existingMetaEnvelopes.length} metaEnvelopes, found ${targetMetaEnvelopes.length}`;
                        console.error(`[MIGRATION ERROR] ${error}`);
                        return reply.status(500).send({ error });
                    }

                    // Verify IDs match
                    const sourceIds = new Set(
                        existingMetaEnvelopes.map((m) => m.id),
                    );
                    const targetIds = new Set(
                        targetMetaEnvelopes.map((m) => m.id),
                    );

                    if (sourceIds.size !== targetIds.size) {
                        const error =
                            "Copy verification failed: ID count mismatch";
                        console.error(`[MIGRATION ERROR] ${error}`);
                        return reply.status(500).send({ error });
                    }

                    for (const id of sourceIds) {
                        if (!targetIds.has(id)) {
                            const error = `Copy verification failed: missing metaEnvelope ID: ${id}`;
                            console.error(`[MIGRATION ERROR] ${error}`);
                            return reply.status(500).send({ error });
                        }
                    }

                    console.log(
                        `[MIGRATION] Verification successful: ${copiedCount} metaEnvelopes copied and verified`,
                    );

                    // Close target connection
                    await targetDriver.close();

                    return {
                        success: true,
                        count: copiedCount,
                        message: `Successfully copied ${copiedCount} metaEnvelopes to target evault`,
                    };
                } catch (copyError) {
                    await targetDriver.close();
                    throw copyError;
                }
            } catch (error) {
                console.error(`[MIGRATION ERROR] Migration failed:`, error);
                return reply.status(500).send({
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to migrate metaEnvelopes",
                });
            }
        },
    );
}
