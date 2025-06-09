import { DocumentData } from 'firebase-admin/firestore';

export interface MetaEnvelope {
  id: string;
  schemaId: string;
  data: Record<string, any>;
  acl: string[];
  createdAt: string;
  updatedAt: string;
  w3id: string;
}

export interface Web3AdapterConfig {
  registryUrl: string;
  webhookSecret: string;
  webhookEndpoint: string;
}

export interface IDMapping {
  platformId: string;
  metaEnvelopeId: string;
  entityType: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntityWatcher {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface DataTransformer<T extends DocumentData> {
  toGlobal(data: T): Promise<MetaEnvelope>;
  fromGlobal(envelope: MetaEnvelope): Promise<T>;
}

export interface WebhookEvent {
  metaEnvelopeId: string;
  w3id: string;
  eventType: 'created' | 'updated' | 'deleted';
  timestamp: string;
}

export interface GraphQLClient {
  storeMetaEnvelope(envelope: MetaEnvelope): Promise<string>;
  fetchMetaEnvelope(id: string, w3id: string): Promise<MetaEnvelope>;
  storeReference(w3id: string, referenceId: string): Promise<void>;
}

export interface IDMappingStore {
  store(platformId: string, metaEnvelopeId: string, entityType: string): Promise<void>;
  getMetaEnvelopeId(platformId: string, entityType: string): Promise<string | null>;
  getPlatformId(metaEnvelopeId: string, entityType: string): Promise<string | null>;
} 