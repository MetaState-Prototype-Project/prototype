import { GraphQLClient, gql } from 'graphql-request';

// TODO: Define MetaStateMetaEnvelope interface (or import)

const STORE_META_ENVELOPE_MUTATION = gql`
  mutation StoreMetaEnvelope($input: StoreMetaEnvelopeInput!) {
    storeMetaEnvelope(input: $input) {
      id # Or other fields to confirm success
    }
  }
`;

export class EvaultWriter {
  private client: GraphQLClient;

  constructor(evaultGraphQLEndpoint: string, authToken?: string) {
    const requestHeaders: Record<string, string> = {};
    if (authToken) {
      requestHeaders['authorization'] = `Bearer ${authToken}`;
    }
    this.client = new GraphQLClient(evaultGraphQLEndpoint, { headers: requestHeaders });
  }

  // async storeEnvelope(envelope: any /* MetaStateMetaEnvelope<any> */): Promise<any> {
  //   try {
  //     const variables = { input: envelope };
  //     const response = await this.client.request(STORE_META_ENVELOPE_MUTATION, variables);
  //     console.log('Envelope stored:', response);
  //     return response;
  //   } catch (error) {
  //     console.error('Error storing envelope in eVault:', error);
  //     throw error;
  //   }
  // }

  // async storeBatch(envelopes: any[]): Promise<void> {
  //   for (const envelope of envelopes) {
  //     await this.storeEnvelope(envelope);
  //     // TODO: Consider batching API calls if eVault supports it, or add delays.
  //   }
  // }
}
