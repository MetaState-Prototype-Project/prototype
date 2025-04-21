import fastify, { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { W3ID } from "w3id";
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
              w3id: { type: "object" },
              logs: {
                type: "array",
                items: { type: "object" },
              },
            },
          },
        },
      },
    },
    async (request: TypedRequest<{}>, reply: TypedReply) => {
      // TODO: Implement actual W3ID verification and log retrieval
      const w3id = new W3ID({} as any); // TODO: Add proper W3ID initialization
      return {
        w3id: w3id,
        logs: [], // TODO: Implement log retrieval
      };
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
