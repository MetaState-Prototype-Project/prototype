import fastify, { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { W3ID } from "../w3id/w3id";
import { LogEvent } from "w3id";
import axios from "axios";
import { WatcherRequest, TypedRequest, TypedReply } from "./types";
import { verifierCallback } from "../utils/signer";

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
  server: FastifyInstance
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
      ],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: "/docs",
  });

  // Whois endpoint
  server.get(
    "/whois",
    {
      schema: {
        tags: ["identity"],
        description: "Get W3ID response with logs",
        response: {
          200: {
            type: "object",
            properties: {
              w3id: { type: "string" },
              logs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    versionId: { type: "string" },
                    versionTime: { type: "string", format: "date-time" },
                    updateKeys: { type: "array", items: { type: "string" } },
                    nextKeyHashes: { type: "array", items: { type: "string" } },
                    method: { type: "string" },
                    proofs: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          signature: { type: "string" },
                          alg: { type: "string" },
                          kid: { type: "string" },
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
    },
    async (request: TypedRequest<{}>, reply: TypedReply) => {
      const w3id = await W3ID.get();
      const logs = (await w3id.logs?.repository.findMany({})) as LogEvent[];
      const result = {
        w3id: w3id.id,
        logs: logs,
      };
      console.log(result);
      return result;
    }
  );

  // Watchers signature endpoint
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
        };
      }
    }
  );

  // Watchers request endpoint
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
}
