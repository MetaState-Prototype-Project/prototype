import { web3AdapterConfig } from "../config";

export type EntityType = "User" | "Post" | "Comment" | "Chat" | "Message" | "MessageReadStatus";
export type GlobalOntologyType = typeof web3AdapterConfig.entityMappings[EntityType];

export interface MetaEnvelopePayload {
    [key: string]: any;
}

export interface WebhookPayload {
    metaEnvelopeId: string;
    entityType: GlobalOntologyType;
    operation: "create" | "update" | "delete";
    payload: MetaEnvelopePayload;
    timestamp: string;
    signature: string;
}

export interface TransformContext {
    platform: "blabsy" | "pictique";
    entityType: EntityType;
    internalId: string;
    parentMetaEnvelopeId?: string;
}

export interface eVaultResponse {
    metaEnvelope: {
        id: string;
        ontology: string;
        parsed: any;
    };
    envelopes: Array<{
        id: string;
        ontology: string;
        value: any;
        valueType: string;
    }>;
} 