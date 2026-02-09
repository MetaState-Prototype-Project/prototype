// GraphQL Schema Definition
export const typeDefs = /* GraphQL */ `
    scalar JSON

    type Envelope {
        id: String!
        "The field name from the payload (kept for backward compatibility, prefer fieldKey)"
        ontology: String!
        "The field name from the payload - clearer alias for ontology"
        fieldKey: String!
        value: JSON
        valueType: String
    }

    type MetaEnvelope {
        id: String!
        "The ontology schema ID (W3ID)"
        ontology: String!
        envelopes: [Envelope!]!
        parsed: JSON
    }

    "Result type for legacy storeMetaEnvelope and updateMetaEnvelopeById mutations"
    type StoreMetaEnvelopeResult {
        metaEnvelope: MetaEnvelope!
        envelopes: [Envelope!]!
    }

    # ============================================================================
    # Pagination Types (Relay-style connections)
    # ============================================================================

    type PageInfo {
        hasNextPage: Boolean!
        hasPreviousPage: Boolean!
        startCursor: String
        endCursor: String
    }

    type MetaEnvelopeEdge {
        cursor: String!
        node: MetaEnvelope!
    }

    type MetaEnvelopeConnection {
        edges: [MetaEnvelopeEdge!]!
        pageInfo: PageInfo!
        totalCount: Int
    }

    # ============================================================================
    # Search and Filter Types
    # ============================================================================

    enum SearchMode {
        "Match if term appears anywhere in the value"
        CONTAINS
        "Match if value starts with the term"
        STARTS_WITH
        "Match only exact matches"
        EXACT
    }

    input MetaEnvelopeSearchInput {
        "The search term to look for"
        term: String
        "Whether the search should be case-sensitive (default: false)"
        caseSensitive: Boolean = false
        "Specific field names to search within (searches all fields if not provided)"
        fields: [String!]
        "The matching mode for the search (default: CONTAINS)"
        mode: SearchMode = CONTAINS
    }

    input MetaEnvelopeFilterInput {
        "Filter by ontology schema ID"
        ontologyId: ID
        "Search within envelope values"
        search: MetaEnvelopeSearchInput
    }

    # ============================================================================
    # Mutation Payloads (Idiomatic GraphQL)
    # ============================================================================

    "Represents a user-facing error from a mutation"
    type UserError {
        "The field that caused the error, if applicable"
        field: String
        "Human-readable error message"
        message: String!
        "Machine-readable error code"
        code: String
    }

    type CreateMetaEnvelopePayload {
        "The created MetaEnvelope, null if errors occurred"
        metaEnvelope: MetaEnvelope
        "List of errors that occurred during the mutation"
        errors: [UserError!]
    }

    type UpdateMetaEnvelopePayload {
        "The updated MetaEnvelope, null if errors occurred"
        metaEnvelope: MetaEnvelope
        "List of errors that occurred during the mutation"
        errors: [UserError!]
    }

    type DeleteMetaEnvelopePayload {
        "The ID of the deleted MetaEnvelope"
        deletedId: ID!
        "Whether the deletion was successful"
        success: Boolean!
        "List of errors that occurred during the mutation"
        errors: [UserError!]
    }

    "Individual result for bulk create operation"
    type BulkCreateResult {
        "The ID of the created/attempted MetaEnvelope"
        id: ID!
        "Whether this individual create was successful"
        success: Boolean!
        "Error message if creation failed"
        error: String
    }

    type BulkCreateMetaEnvelopesPayload {
        "Individual results for each input"
        results: [BulkCreateResult!]!
        "Total number of successfully created MetaEnvelopes"
        successCount: Int!
        "Total number of failed creations"
        errorCount: Int!
        "Global errors (e.g., authentication failures)"
        errors: [UserError!]
    }

    # ============================================================================
    # Queries
    # ============================================================================

    type Query {
        # --- NEW IDIOMATIC API ---
        "Retrieve a single MetaEnvelope by its ID"
        metaEnvelope(id: ID!): MetaEnvelope

        "Retrieve MetaEnvelopes with pagination and optional filtering"
        metaEnvelopes(
            "Filter criteria for the query"
            filter: MetaEnvelopeFilterInput
            "Number of items to return (forward pagination)"
            first: Int
            "Cursor to start after (forward pagination)"
            after: String
            "Number of items to return (backward pagination)"
            last: Int
            "Cursor to start before (backward pagination)"
            before: String
        ): MetaEnvelopeConnection!

        # --- LEGACY API (preserved for backward compatibility) ---
        getMetaEnvelopeById(id: String!): MetaEnvelope
        findMetaEnvelopesByOntology(ontology: String!): [MetaEnvelope!]!
        searchMetaEnvelopes(ontology: String!, term: String!): [MetaEnvelope!]!
        getAllEnvelopes: [Envelope!]!
    }

    # ============================================================================
    # Inputs
    # ============================================================================

    input MetaEnvelopeInput {
        ontology: String!
        payload: JSON!
        acl: [String!]!
    }

    "Input for bulk create operations (e.g., migrations)"
    input BulkMetaEnvelopeInput {
        "Optional ID to preserve during migration (generated if not provided)"
        id: ID
        ontology: String!
        payload: JSON!
        acl: [String!]!
    }

    # ============================================================================
    # Mutations
    # ============================================================================

    type Mutation {
        # --- NEW IDIOMATIC API ---
        "Create a new MetaEnvelope"
        createMetaEnvelope(input: MetaEnvelopeInput!): CreateMetaEnvelopePayload!

        "Update an existing MetaEnvelope by ID"
        updateMetaEnvelope(id: ID!, input: MetaEnvelopeInput!): UpdateMetaEnvelopePayload!

        "Delete a MetaEnvelope by ID"
        removeMetaEnvelope(id: ID!): DeleteMetaEnvelopePayload!

        "Bulk create MetaEnvelopes (optimized for migrations)"
        bulkCreateMetaEnvelopes(
            "Array of MetaEnvelopes to create"
            inputs: [BulkMetaEnvelopeInput!]!
            "Skip webhook delivery (only allowed for migration platforms)"
            skipWebhooks: Boolean = false
        ): BulkCreateMetaEnvelopesPayload!

        # --- LEGACY API (preserved for backward compatibility) ---
        storeMetaEnvelope(input: MetaEnvelopeInput!): StoreMetaEnvelopeResult!
        deleteMetaEnvelope(id: String!): Boolean!
        updateEnvelopeValue(envelopeId: String!, newValue: JSON!): Boolean!
        updateMetaEnvelopeById(id: String!, input: MetaEnvelopeInput!): StoreMetaEnvelopeResult!
    }
`;
