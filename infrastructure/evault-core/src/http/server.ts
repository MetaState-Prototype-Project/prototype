import fastify, { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { W3ID } from "../w3id/w3id";
import { LogEvent } from "w3id";
import {
  WatcherSignatureRequest,
  WatcherRequest,
  TypedRequest,
  TypedReply,
} from "./types";

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
          required: ["w3id", "signature", "logEntryId"],
          properties: {
            w3id: { type: "string" },
            signature: { type: "string" },
            logEntryId: { type: "string" },
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
      const { w3id, signature, logEntryId } = request.body;
      // TODO: Implement signature verification and storage
      return {
        success: true,
        message: "Signature stored successfully",
      };
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
      // TODO: Implement signature request logic
      return {
        success: true,
        message: "Signature request created",
        requestId: "req_" + Date.now(),
      };
    }
  );
}
