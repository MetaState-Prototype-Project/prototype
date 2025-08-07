/**
 * EVault Synchronization Module
 * Handles bidirectional sync with eVault using Web3 Protocol
 */

import type { 
    MetaEnvelope, 
    Web3ProtocolPayload 
} from '../../../infrastructure/web3-adapter/src/types.js';
import type { BeeperWeb3Adapter } from './BeeperWeb3Adapter.js';

export class EVaultSync {
    private adapter: BeeperWeb3Adapter;
    private eVaultUrl: string;
    private lastSyncTimestamp: Date;

    constructor(adapter: BeeperWeb3Adapter, eVaultUrl: string) {
        this.adapter = adapter;
        this.eVaultUrl = eVaultUrl;
        this.lastSyncTimestamp = new Date();
    }

    /**
     * Send a MetaEnvelope to eVault
     */
    async sendToEVault(payload: Web3ProtocolPayload): Promise<void> {
        try {
            const response = await fetch(`${this.eVaultUrl}/graphql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: this.getStoreMutation(),
                    variables: {
                        input: {
                            id: payload.metaEnvelope.id,
                            ontology: payload.metaEnvelope.ontology,
                            acl: payload.metaEnvelope.acl,
                            envelopes: payload.metaEnvelope.envelopes,
                            operation: payload.operation
                        }
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`eVault request failed: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.errors) {
                throw new Error(`eVault errors: ${JSON.stringify(result.errors)}`);
            }

            console.log(`✅ Sent to eVault: ${payload.metaEnvelope.id}`);
        } catch (error) {
            console.error('Failed to send to eVault:', error);
            throw error;
        }
    }

    /**
     * Get new messages from eVault since last sync
     */
    async getNewMessages(): Promise<MetaEnvelope[]> {
        try {
            const response = await fetch(`${this.eVaultUrl}/graphql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: this.getQueryMessages(),
                    variables: {
                        since: this.lastSyncTimestamp.toISOString(),
                        ontology: 'Message'
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`eVault request failed: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.errors) {
                throw new Error(`eVault errors: ${JSON.stringify(result.errors)}`);
            }

            this.lastSyncTimestamp = new Date();
            return result.data?.metaEnvelopes || [];
        } catch (error) {
            console.error('Failed to get messages from eVault:', error);
            return [];
        }
    }

    /**
     * Subscribe to real-time updates from eVault
     */
    async subscribeToUpdates(callback: (metaEnvelope: MetaEnvelope) => void): Promise<void> {
        // In production, this would use WebSocket or Server-Sent Events
        // For now, we'll use polling
        setInterval(async () => {
            const newMessages = await this.getNewMessages();
            for (const message of newMessages) {
                callback(message);
            }
        }, 10000); // Poll every 10 seconds

        console.log('📡 Subscribed to eVault updates');
    }

    /**
     * Update an existing MetaEnvelope in eVault
     */
    async updateInEVault(metaEnvelope: MetaEnvelope): Promise<void> {
        const payload: Web3ProtocolPayload = {
            metaEnvelope,
            operation: 'update'
        };
        await this.sendToEVault(payload);
    }

    /**
     * Delete a MetaEnvelope from eVault
     */
    async deleteFromEVault(metaEnvelopeId: string): Promise<void> {
        try {
            const response = await fetch(`${this.eVaultUrl}/graphql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: this.getDeleteMutation(),
                    variables: {
                        id: metaEnvelopeId
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`eVault request failed: ${response.statusText}`);
            }

            console.log(`✅ Deleted from eVault: ${metaEnvelopeId}`);
        } catch (error) {
            console.error('Failed to delete from eVault:', error);
            throw error;
        }
    }

    /**
     * Search messages in eVault
     */
    async searchMessages(query: string): Promise<MetaEnvelope[]> {
        try {
            const response = await fetch(`${this.eVaultUrl}/graphql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: this.getSearchQuery(),
                    variables: {
                        searchTerm: query,
                        ontology: 'Message'
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`eVault request failed: ${response.statusText}`);
            }

            const result = await response.json();
            return result.data?.searchResults || [];
        } catch (error) {
            console.error('Failed to search eVault:', error);
            return [];
        }
    }

    /**
     * GraphQL mutation for storing MetaEnvelope
     */
    private getStoreMutation(): string {
        return `
            mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                storeMetaEnvelope(input: $input) {
                    success
                    metaEnvelope {
                        id
                        ontology
                        acl
                    }
                }
            }
        `;
    }

    /**
     * GraphQL query for getting messages
     */
    private getQueryMessages(): string {
        return `
            query GetNewMessages($since: String!, $ontology: String!) {
                metaEnvelopes(since: $since, ontology: $ontology) {
                    id
                    ontology
                    acl
                    envelopes {
                        id
                        ontology
                        value
                        valueType
                    }
                    createdAt
                    updatedAt
                }
            }
        `;
    }

    /**
     * GraphQL mutation for deleting MetaEnvelope
     */
    private getDeleteMutation(): string {
        return `
            mutation DeleteMetaEnvelope($id: String!) {
                deleteMetaEnvelope(id: $id) {
                    success
                }
            }
        `;
    }

    /**
     * GraphQL query for searching
     */
    private getSearchQuery(): string {
        return `
            query SearchMessages($searchTerm: String!, $ontology: String!) {
                searchResults: search(term: $searchTerm, ontology: $ontology) {
                    id
                    ontology
                    acl
                    envelopes {
                        id
                        ontology
                        value
                        valueType
                    }
                    relevance
                }
            }
        `;
    }
}