import { GraphQLClient } from "graphql-request";
import axios from "axios";

export interface MetaEnvelope {
    id?: string | null;
    schemaId: string;
    data: Record<string, any>;
    w3id: string;
}

const STORE_META_ENVELOPE = `
  mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
    storeMetaEnvelope(input: $input) {
      metaEnvelope {
        id
        ontology
        parsed
      }
    }
  }
`;

const FETCH_META_ENVELOPE = `
  query FetchMetaEnvelope($id: ID!) {
    metaEnvelope(id: $id) {
      id
      ontology
      parsed
    }
  }
`;

const UPDATE_META_ENVELOPE = `
  mutation UpdateMetaEnvelopeById($id: String!, $input: MetaEnvelopeInput!) {
    updateMetaEnvelopeById(id: $id, input: $input) {
      metaEnvelope {
        id
        ontology
        parsed
      }
      envelopes {
        id
        ontology
        value
        valueType
      }
    }
  }
`;

interface MetaEnvelopeResponse {
    metaEnvelope: MetaEnvelope;
}

interface StoreMetaEnvelopeResponse {
    storeMetaEnvelope: {
        metaEnvelope: {
            id: string;
            ontology: string;
            envelopes: Array<{
                id: string;
                ontology: string;
                value: any;
                valueType: string;
            }>;
            parsed: any;
        };
        envelopes: Array<{
            id: string;
            ontology: string;
            value: any;
            valueType: string;
        }>;
    };
    updateMetaEnvelopeById: {
        metaEnvelope: {
            id: string;
            ontology: string;
            envelopes: Array<{
                id: string;
                ontology: string;
                value: any;
                valueType: string;
            }>;
            parsed: any;
        };
        envelopes: Array<{
            id: string;
            ontology: string;
            value: any;
            valueType: string;
        }>;
    };
}

export class EVaultClient {
    private client: GraphQLClient | null = null;
    private endpoint: string | null = null;

    constructor(private registryUrl: string) {}

    private async resolveEndpoint(w3id: string): Promise<string> {
        try {
            const response = await axios.get(
                new URL(`/resolve?w3id=${w3id}`, this.registryUrl).toString()
            );
            return new URL("/graphql", response.data.uri).toString();
        } catch (error) {
            console.error("Error resolving eVault endpoint:", error);
            throw new Error("Failed to resolve eVault endpoint");
        }
    }

    private async ensureClient(w3id: string): Promise<GraphQLClient> {
        if (!this.endpoint || !this.client) {
            this.endpoint = await this.resolveEndpoint(w3id);
            this.client = new GraphQLClient(this.endpoint);
        }
        return this.client;
    }

    async storeMetaEnvelope(envelope: MetaEnvelope): Promise<string> {
        const client = await this.ensureClient(envelope.w3id);

        try {
            const response = await client.request<StoreMetaEnvelopeResponse>(
                STORE_META_ENVELOPE,
                {
                    input: {
                        ontology: envelope.schemaId,
                        payload: envelope.data,
                        acl: ["*"],
                    },
                }
            );
            return response.storeMetaEnvelope.metaEnvelope.id;
        } catch (error) {
            console.error("Error storing meta envelope:", error);
            throw error;
        }
    }

    async storeReference(referenceId: string, w3id: string): Promise<void> {
        const client = await this.ensureClient(w3id);

        try {
            const response = await client.request<StoreMetaEnvelopeResponse>(
                STORE_META_ENVELOPE,
                {
                    input: {
                        ontology: "reference",
                        payload: {
                            _by_reference: referenceId,
                        },
                        acl: ["*"],
                    },
                }
            );

            response.storeMetaEnvelope.metaEnvelope.id;
            return;
        } catch (error) {
            console.error("Error storing reference:", error);
            throw error;
        }
    }

    async fetchMetaEnvelope(id: string, w3id: string): Promise<MetaEnvelope> {
        const client = await this.ensureClient(w3id);

        try {
            const response = await client.request<MetaEnvelopeResponse>(
                FETCH_META_ENVELOPE,
                {
                    id,
                    w3id,
                }
            );
            return response.metaEnvelope;
        } catch (error) {
            console.error("Error fetching meta envelope:", error);
            throw error;
        }
    }

    async updateMetaEnvelopeById(
        id: string,
        envelope: MetaEnvelope
    ): Promise<StoreMetaEnvelopeResponse["storeMetaEnvelope"]> {
        const client = await this.ensureClient(envelope.w3id);

        try {
            const variables = {
                id,
                input: {
                    ontology: envelope.schemaId,
                    payload: envelope.data,
                    acl: ["*"],
                },
            };

            const response = await client.request<StoreMetaEnvelopeResponse>(
                UPDATE_META_ENVELOPE,
                variables
            );
            return response.updateMetaEnvelopeById;
        } catch (error) {
            console.error("Error updating meta envelope:", error);
            throw error;
        }
    }
}
