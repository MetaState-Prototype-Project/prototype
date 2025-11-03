import { FastifyReply, FastifyRequest } from "fastify";

export interface WatcherSignatureRequest {
  w3id: string;
  signature: string;
  logEntryId: string;
}

export interface WatcherRequest {
  w3id: string;
  logEntryId: string;
}

export type TypedRequest<T> = FastifyRequest<{
  Body: T;
}>;

export type TypedReply = FastifyReply;
