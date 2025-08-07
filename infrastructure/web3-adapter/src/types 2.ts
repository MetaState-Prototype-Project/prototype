export interface SchemaMapping {
    tableName: string;
    schemaId: string;
    ownerEnamePath: string;
    ownedJunctionTables: string[];
    localToUniversalMap: Record<string, string>;
}

export interface Envelope {
    id: string;
    ontology: string;
    value: any;
    valueType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'blob';
}

export interface MetaEnvelope {
    id: string;
    ontology: string;
    acl: string[];
    envelopes: Envelope[];
}

export interface IdMapping {
    w3Id: string;
    localId: string;
    platform: string;
    resourceType: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ACL {
    read: string[];
    write: string[];
}

export interface PlatformData {
    [key: string]: any;
    _acl_read?: string[];
    _acl_write?: string[];
}

export interface OntologySchema {
    id: string;
    name: string;
    version: string;
    fields: Record<string, OntologyField>;
}

export interface OntologyField {
    type: string;
    required: boolean;
    description?: string;
}

export interface Web3ProtocolPayload {
    metaEnvelope: MetaEnvelope;
    operation: 'create' | 'update' | 'delete' | 'read';
}

export interface AdapterConfig {
    platform: string;
    ontologyServerUrl: string;
    eVaultUrl: string;
    enableCaching?: boolean;
}