import { web3AdapterConfig } from "../config";
import axios from "axios";

interface MetaEnvelopeMapping {
    entityType: string;
    internalId: string;
    metaEnvelopeId: string;
}

class eVaultServiceClass {
    private static instance: eVaultServiceClass;
    private constructor() {}

    static getInstance(): eVaultServiceClass {
        if (!eVaultServiceClass.instance) {
            eVaultServiceClass.instance = new eVaultServiceClass();
        }
        return eVaultServiceClass.instance;
    }

    async storeMetaEnvelope(
        ownerEname: string,
        ontology: string,
        data: Record<string, any>
    ) {
        const response = await axios.post(web3AdapterConfig.eVault.graphqlUrl, {
            query: `
                mutation StoreMetaEnvelope($input: StoreMetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
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
            `,
            variables: {
                input: {
                    ownerEname,
                    ontology,
                    data,
                    acl: web3AdapterConfig.eVault.defaultAcl
                }
            }
        });

        if (response.data.errors) {
            throw new Error(`Failed to store meta envelope: ${response.data.errors[0].message}`);
        }

        return response.data.data.storeMetaEnvelope;
    }

    async findMetaEnvelopeMapping(
        entityType: string,
        internalId: string
    ): Promise<MetaEnvelopeMapping | null> {
        const response = await axios.post(web3AdapterConfig.eVault.graphqlUrl, {
            query: `
                query FindMetaEnvelopeMapping($entityType: String!, $internalId: String!) {
                    findMetaEnvelopeMapping(entityType: $entityType, internalId: $internalId) {
                        entityType
                        internalId
                        metaEnvelopeId
                    }
                }
            `,
            variables: {
                entityType,
                internalId
            }
        });

        if (response.data.errors) {
            throw new Error(`Failed to find meta envelope mapping: ${response.data.errors[0].message}`);
        }

        return response.data.data.findMetaEnvelopeMapping;
    }
}

export const eVaultService = eVaultServiceClass.getInstance(); 