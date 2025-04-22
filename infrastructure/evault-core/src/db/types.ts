/**
 * Represents a meta-envelope that contains multiple envelopes of data.
 */
export type MetaEnvelope<T extends Record<string, any> = Record<string, any>> =
  {
    ontology: string;
    payload: T;
    acl: string[];
  };

/**
 * Represents an individual envelope containing a single piece of data.
 */
export type Envelope<T = any> = {
  id: string;
  value: T;
  ontology: string;
  valueType: string;
};

/**
 * Base result type for all database operations that return a meta-envelope.
 * Includes the parsed payload structure reconstructed from the envelopes.
 */
export type MetaEnvelopeResult<
  T extends Record<string, any> = Record<string, any>,
> = {
  id: string;
  ontology: string;
  acl: string[];
  envelopes: Envelope<T[keyof T]>[];
  parsed: T;
};

/**
 * Result type for storing a new meta-envelope.
 */
export type StoreMetaEnvelopeResult<
  T extends Record<string, any> = Record<string, any>,
> = {
  metaEnvelope: {
    id: string;
    ontology: string;
    acl: string[];
  };
  envelopes: Envelope<T[keyof T]>[];
};

/**
 * Result type for searching meta-envelopes.
 */
export type SearchMetaEnvelopesResult<
  T extends Record<string, any> = Record<string, any>,
> = MetaEnvelopeResult<T>[];

/**
 * Result type for retrieving all envelopes.
 */
export type GetAllEnvelopesResult<T = any> = Envelope<T>[];
