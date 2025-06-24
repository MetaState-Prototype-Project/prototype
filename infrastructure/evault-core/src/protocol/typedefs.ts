// GraphQL Schema Definition
export const typeDefs = /* GraphQL */ `
    scalar JSON

    type Envelope {
        id: String!
        ontology: String!
        value: JSON
        valueType: String
    }

    type MetaEnvelope {
        id: String!
        ontology: String!
        envelopes: [Envelope!]!
        parsed: JSON
    }

    type StoreMetaEnvelopeResult {
        metaEnvelope: MetaEnvelope!
        envelopes: [Envelope!]!
    }

    type Query {
        getMetaEnvelopeById(id: String!): MetaEnvelope
        findMetaEnvelopesByOntology(ontology: String!): [MetaEnvelope!]!
        searchMetaEnvelopes(ontology: String!, term: String!): [MetaEnvelope!]!
        getAllEnvelopes: [Envelope!]!
    }

    input MetaEnvelopeInput {
        ontology: String!
        payload: JSON!
        acl: [String!]!
    }

    type Mutation {
        storeMetaEnvelope(input: MetaEnvelopeInput!): StoreMetaEnvelopeResult!
        deleteMetaEnvelope(id: String!): Boolean!
        updateEnvelopeValue(envelopeId: String!, newValue: JSON!): Boolean!
        updateMetaEnvelopeById(id: String!, input: MetaEnvelopeInput!): StoreMetaEnvelopeResult!
    }
`;
