import { Document } from "typeorm";

export interface MetaEnvelope {
    id: string;
    schemaId: string;
    data: Record<string, any>;
    acl: string[];
    createdAt: string;
    updatedAt: string;
    w3id: string;
}

export interface DataTransformer<T> {
    toGlobal(data: T): Promise<MetaEnvelope>;
    fromGlobal(envelope: MetaEnvelope): Promise<T>;
}

export interface IDMappingStore {
    storeMapping(localId: string, metaEnvelopeId: string, entityType: string): Promise<void>;
    getMetaEnvelopeId(localId: string, entityType: string): Promise<string | null>;
    getLocalId(metaEnvelopeId: string, entityType: string): Promise<string | null>;
}

export interface WebhookPayload {
    id: string;
    type: "user" | "socialMediaPost" | "comment" | "chat" | "message";
    data: any;
    acl?: string[];
    createdAt: string;
    updatedAt: string;
    w3id: string;
}

export interface WebhookConfig {
    url: string;
    secret: string;
} 