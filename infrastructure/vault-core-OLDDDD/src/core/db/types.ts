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
 * Note: eName is stored internally but not exposed in GraphQL responses.
 */
export type MetaEnvelopeResult<
    T extends Record<string, any> = Record<string, any>
> = {
    id: string;
    ontology: string;
    acl: string[];
    envelopes: Envelope<T[keyof T]>[];
    parsed: T;
    // eName is stored internally but never returned in API responses
    eName?: string;
};

/**
 * Result type for storing a new meta-envelope.
 */
export type StoreMetaEnvelopeResult<
    T extends Record<string, any> = Record<string, any>
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
    T extends Record<string, any> = Record<string, any>
> = MetaEnvelopeResult<T>[];

/**
 * Result type for retrieving all envelopes.
 */
export type GetAllEnvelopesResult<T = any> = Envelope<T>[];

/**
 * Operation type for envelope operation logs.
 */
export type EnvelopeOperationType =
    | "create"
    | "update"
    | "delete"
    | "update_envelope_value";

/**
 * A single envelope operation log entry (returned by GET /logs).
 */
export type EnvelopeOperationLogEntry = {
    id: string;
    eName: string;
    metaEnvelopeId: string;
    envelopeHash: string;
    operation: EnvelopeOperationType;
    platform: string | null;
    timestamp: string;
    ontology?: string;
};

/**
 * Parameters for appending an envelope operation log.
 */
export type AppendEnvelopeOperationLogParams = {
    eName: string;
    metaEnvelopeId: string;
    envelopeHash: string;
    operation: EnvelopeOperationType;
    platform: string | null;
    timestamp: string;
    ontology?: string;
};

/**
 * Result of getEnvelopeOperationLogs (paginated).
 */
export type GetEnvelopeOperationLogsResult = {
    logs: EnvelopeOperationLogEntry[];
    nextCursor: string | null;
    hasMore: boolean;
};

// ============================================================================
// Pagination Types for Idiomatic GraphQL API
// ============================================================================

/**
 * Search mode for MetaEnvelope queries.
 */
export type SearchMode = "CONTAINS" | "STARTS_WITH" | "EXACT";

/**
 * Search input for MetaEnvelope queries.
 */
export type MetaEnvelopeSearchInput = {
    term?: string;
    caseSensitive?: boolean;
    fields?: string[];
    mode?: SearchMode;
};

/**
 * Filter input for MetaEnvelope queries.
 */
export type MetaEnvelopeFilterInput = {
    ontologyId?: string;
    search?: MetaEnvelopeSearchInput;
};

/**
 * Pagination info for Relay-style connections.
 */
export type PageInfo = {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
};

/**
 * Edge type for MetaEnvelope connections.
 */
export type MetaEnvelopeEdge<T extends Record<string, any> = Record<string, any>> = {
    cursor: string;
    node: MetaEnvelopeResult<T>;
};

/**
 * Connection type for paginated MetaEnvelope queries.
 */
export type MetaEnvelopeConnection<T extends Record<string, any> = Record<string, any>> = {
    edges: MetaEnvelopeEdge<T>[];
    pageInfo: PageInfo;
    totalCount: number;
};

/**
 * Options for paginated MetaEnvelope queries.
 */
export type FindMetaEnvelopesPaginatedOptions = {
    filter?: MetaEnvelopeFilterInput;
    first?: number;
    after?: string;
    last?: number;
    before?: string;
};
