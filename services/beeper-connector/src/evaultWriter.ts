import { GraphQLClient, gql } from 'graphql-request';

type MetaEnvelopeInput = {
  ontology: string;
  payload: Record<string, unknown>;
  acl: string[];
};

type StoreResultEnvelope = { id: string; ontology: string; valueType: string };
type StoreResult = { metaEnvelope: { id: string; ontology: string }; envelopes: StoreResultEnvelope[] };

const STORE_META_ENVELOPE_MUTATION = gql`
  mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
    storeMetaEnvelope(input: $input) {
      metaEnvelope { id ontology }
      envelopes { id ontology valueType }
    }
  }
`;

export class EvaultWriter {
  private client: GraphQLClient;

  constructor(evaultGraphQLEndpoint: string, authToken?: string) {
    const requestHeaders: Record<string, string> = {};
    if (authToken) requestHeaders.authorization = `Bearer ${authToken}`;
    this.client = new GraphQLClient(evaultGraphQLEndpoint, { headers: requestHeaders });
  }

  async storeEnvelope(input: MetaEnvelopeInput): Promise<StoreResult> {
    try {
      const variables = { input };
      const response = await this.client.request(STORE_META_ENVELOPE_MUTATION, variables);
      return response.storeMetaEnvelope;
    } catch (error) {
      console.error('Error storing envelope in eVault:', error);
      throw error;
    }
  }

  async storeBatch(inputs: MetaEnvelopeInput[], delayMs = 0): Promise<StoreResult[]> {
    const results: StoreResult[] = [];
    for (const input of inputs) {
      const res = await this.storeEnvelope(input);
      results.push(res);
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return results;
  }
}
