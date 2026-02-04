import neo4j, { type Driver } from "neo4j-driver";
import { W3IDBuilder } from "w3id";
import { deserializeValue, serializeValue } from "./schema";
import type {
    AppendEnvelopeOperationLogParams,
    Envelope,
    EnvelopeOperationLogEntry,
    FindMetaEnvelopesPaginatedOptions,
    GetAllEnvelopesResult,
    GetEnvelopeOperationLogsResult,
    MetaEnvelope,
    MetaEnvelopeConnection,
    MetaEnvelopeEdge,
    MetaEnvelopeFilterInput,
    MetaEnvelopeResult,
    MetaEnvelopeSearchInput,
    PageInfo,
    SearchMetaEnvelopesResult,
    StoreMetaEnvelopeResult,
} from "./types";

/**
 * Service for managing meta-envelopes and their associated envelopes in Neo4j.
 * Provides functionality for storing, retrieving, searching, and updating data
 * with proper type handling and access control.
 */
export class DbService {
    private driver: Driver;

    /**
     * Creates a new instance of the DbService.
     */
    constructor(driver: Driver) {
        this.driver = driver;
    }

    /**
     * Executes a Cypher query with the given parameters.
     * @param query - The Cypher query to execute
     * @param params - The parameters for the query
     * @returns The result of the query execution
     */
    private async runQueryInternal(query: string, params: Record<string, any>) {
        const session = this.driver.session();
        try {
            return await session.run(query, params);
        } finally {
            await session.close();
        }
    }

    /**
     * Executes a Cypher query with the given parameters.
     * Exposed for cross-evault operations.
     * @param query - The Cypher query to execute
     * @param params - The parameters for the query
     * @returns The result of the query execution
     */
    async runQuery(query: string, params: Record<string, any>) {
        return this.runQueryInternal(query, params);
    }

    /**
     * Stores a new meta-envelope and its associated envelopes.
     * @param meta - The meta-envelope data (without ID)
     * @param acl - The access control list for the meta-envelope
     * @param eName - The eName identifier for multi-tenant isolation
     * @returns The created meta-envelope and its envelopes
     */
    async storeMetaEnvelope<
        T extends Record<string, any> = Record<string, any>,
    >(
        meta: Omit<MetaEnvelope<T>, "id">,
        acl: string[],
        eName: string,
    ): Promise<StoreMetaEnvelopeResult<T>> {
        if (!eName) {
            throw new Error("eName is required for storing meta-envelopes");
        }

        const w3id = await new W3IDBuilder().build();

        const cypher: string[] = [
            `CREATE (m:MetaEnvelope { id: $metaId, ontology: $ontology, acl: $acl, eName: $eName })`,
        ];

        const envelopeParams: Record<string, any> = {
            metaId: w3id.id,
            ontology: meta.ontology,
            acl: acl,
            eName: eName,
        };

        const createdEnvelopes: Envelope<T[keyof T]>[] = [];
        let counter = 0;

        for (const [key, value] of Object.entries(meta.payload)) {
            const envW3id = await new W3IDBuilder().build();
            const envelopeId = envW3id.id;
            const alias = `e${counter}`;

            const { value: storedValue, type: valueType } =
                serializeValue(value);

            cypher.push(`
      CREATE (${alias}:Envelope {
        id: $${alias}_id,
        ontology: $${alias}_ontology,
        value: $${alias}_value,
        valueType: $${alias}_type
      })
      WITH m, ${alias}
      MERGE (m)-[:LINKS_TO]->(${alias})
    `);

            envelopeParams[`${alias}_id`] = envelopeId;
            envelopeParams[`${alias}_ontology`] = key;
            envelopeParams[`${alias}_value`] = storedValue;
            envelopeParams[`${alias}_type`] = valueType;

            createdEnvelopes.push({
                id: envelopeId,
                ontology: key,
                value: value as T[keyof T],
                valueType,
            });

            counter++;
        }

        await this.runQueryInternal(cypher.join("\n"), envelopeParams);

        return {
            metaEnvelope: {
                id: w3id.id,
                ontology: meta.ontology,
                acl: acl,
            },
            envelopes: createdEnvelopes,
        };
    }

    /**
     * Finds meta-envelopes containing the search term in any of their envelopes.
     * Returns all envelopes from the matched meta-envelopes.
     * @param ontology - The ontology to search within
     * @param searchTerm - The term to search for
     * @param eName - The eName identifier for multi-tenant isolation
     * @returns Array of matched meta-envelopes with their complete envelope sets
     */
    async findMetaEnvelopesBySearchTerm<
        T extends Record<string, any> = Record<string, any>,
    >(
        ontology: string,
        searchTerm: string,
        eName: string,
    ): Promise<SearchMetaEnvelopesResult<T>> {
        if (!eName) {
            throw new Error("eName is required for searching meta-envelopes");
        }

        const result = await this.runQueryInternal(
            `
    MATCH (m:MetaEnvelope { ontology: $ontology, eName: $eName })-[:LINKS_TO]->(e:Envelope)
    WHERE
      CASE e.valueType
        WHEN 'string' THEN toLower(e.value) CONTAINS toLower($term)
        WHEN 'array' THEN ANY(x IN e.value WHERE toLower(toString(x)) CONTAINS toLower($term))
        WHEN 'object' THEN toLower(toString(e.value)) CONTAINS toLower($term)
        ELSE toLower(toString(e.value)) CONTAINS toLower($term)
      END
    WITH m
    MATCH (m)-[:LINKS_TO]->(allEnvelopes:Envelope)
    RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, collect(allEnvelopes) AS envelopes
    `,
            { ontology, term: searchTerm, eName },
        );

        return result.records.map((record): MetaEnvelopeResult<T> => {
            const envelopes = record
                .get("envelopes")
                .map((node: any): Envelope<T[keyof T]> => {
                    const properties = node.properties;
                    return {
                        id: properties.id,
                        ontology: properties.ontology,
                        value: deserializeValue(
                            properties.value,
                            properties.valueType,
                        ) as T[keyof T],
                        valueType: properties.valueType,
                    };
                });

            const parsed = envelopes.reduce(
                (acc: T, envelope: Envelope<T[keyof T]>) => {
                    (acc as any)[envelope.ontology] = envelope.value;
                    return acc;
                },
                {} as T,
            );

            return {
                id: record.get("id"),
                ontology: record.get("ontology"),
                acl: record.get("acl"),
                envelopes,
                parsed,
            };
        });
    }

    /**
     * Finds multiple meta-envelopes by an array of IDs.
     * @param ids - Array of MetaEnvelope IDs
     * @param eName - The eName identifier for multi-tenant isolation
     * @returns Array of meta-envelopes with envelopes and parsed payload
     */
    async findMetaEnvelopesByIds<
        T extends Record<string, any> = Record<string, any>,
    >(ids: string[], eName: string): Promise<MetaEnvelopeResult<T>[]> {
        if (!ids.length) return [];
        if (!eName) {
            throw new Error(
                "eName is required for finding meta-envelopes by IDs",
            );
        }

        const result = await this.runQueryInternal(
            `
    MATCH (m:MetaEnvelope { eName: $eName })-[:LINKS_TO]->(e:Envelope)
    WHERE m.id IN $ids
    RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, collect(e) AS envelopes
    `,
            { ids, eName },
        );

        return result.records.map((record): MetaEnvelopeResult<T> => {
            const envelopes = record
                .get("envelopes")
                .map((node: any): Envelope<T[keyof T]> => {
                    const props = node.properties;
                    return {
                        id: props.id,
                        ontology: props.ontology,
                        value: deserializeValue(
                            props.value,
                            props.valueType,
                        ) as T[keyof T],
                        valueType: props.valueType,
                    };
                });

            const parsed = envelopes.reduce(
                (acc: T, env: Envelope<T[keyof T]>) => {
                    (acc as any)[env.ontology] = env.value;
                    return acc;
                },
                {} as T,
            );

            return {
                id: record.get("id"),
                ontology: record.get("ontology"),
                acl: record.get("acl"),
                envelopes,
                parsed,
            };
        });
    }

    /**
     * Finds a meta-envelope by its ID.
     * @param id - The ID of the meta-envelope to find
     * @param eName - The eName identifier for multi-tenant isolation
     * @returns The meta-envelope with all its envelopes and parsed payload, or null if not found
     */
    async findMetaEnvelopeById<
        T extends Record<string, any> = Record<string, any>,
    >(id: string, eName: string): Promise<MetaEnvelopeResult<T> | null> {
        if (!eName) {
            throw new Error(
                "eName is required for finding meta-envelopes by ID",
            );
        }

        const result = await this.runQueryInternal(
            `
      MATCH (m:MetaEnvelope { id: $id, eName: $eName })-[:LINKS_TO]->(e:Envelope)
      RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, collect(e) AS envelopes
      `,
            { id, eName },
        );

        if (!result.records[0]) return null;

        const record = result.records[0];
        const envelopes = record
            .get("envelopes")
            .map((node: any): Envelope<T[keyof T]> => {
                const properties = node.properties;
                return {
                    id: properties.id,
                    ontology: properties.ontology,
                    value: deserializeValue(
                        properties.value,
                        properties.valueType,
                    ) as T[keyof T],
                    valueType: properties.valueType,
                };
            });

        const parsed = envelopes.reduce(
            (acc: T, envelope: Envelope<T[keyof T]>) => {
                (acc as any)[envelope.ontology] = envelope.value;
                return acc;
            },
            {} as T,
        );

        return {
            id: record.get("id"),
            ontology: record.get("ontology"),
            acl: record.get("acl"),
            envelopes,
            parsed,
        };
    }

    /**
     * Finds all meta-envelopes by ontology with their envelopes and parsed payload.
     * @param ontology - The ontology to search for
     * @param eName - The eName identifier for multi-tenant isolation
     * @returns Array of meta-envelopes
     */
    async findMetaEnvelopesByOntology<
        T extends Record<string, any> = Record<string, any>,
    >(ontology: string, eName: string): Promise<MetaEnvelopeResult<T>[]> {
        if (!eName) {
            throw new Error(
                "eName is required for finding meta-envelopes by ontology",
            );
        }

        const result = await this.runQueryInternal(
            `
    MATCH (m:MetaEnvelope { ontology: $ontology, eName: $eName })-[:LINKS_TO]->(e:Envelope)
    RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, collect(e) AS envelopes
    `,
            { ontology, eName },
        );

        return result.records.map((record) => {
            const envelopes = record
                .get("envelopes")
                .map((node: any): Envelope<T[keyof T]> => {
                    const properties = node.properties;
                    return {
                        id: properties.id,
                        ontology: properties.ontology,
                        value: deserializeValue(
                            properties.value,
                            properties.valueType,
                        ) as T[keyof T],
                        valueType: properties.valueType,
                    };
                });

            const parsed = envelopes.reduce(
                (acc: T, envelope: Envelope<T[keyof T]>) => {
                    (acc as any)[envelope.ontology] = envelope.value;
                    return acc;
                },
                {} as T,
            );

            return {
                id: record.get("id"),
                ontology: record.get("ontology"),
                acl: record.get("acl"),
                envelopes,
                parsed,
            };
        });
    }

    /**
     * Deletes a meta-envelope and all its associated envelopes.
     * @param id - The ID of the meta-envelope to delete
     * @param eName - The eName identifier for multi-tenant isolation
     */
    async deleteMetaEnvelope(id: string, eName: string): Promise<void> {
        if (!eName) {
            throw new Error("eName is required for deleting meta-envelopes");
        }

        await this.runQueryInternal(
            `
      MATCH (m:MetaEnvelope { id: $id, eName: $eName })-[:LINKS_TO]->(e:Envelope)
      DETACH DELETE m, e
      `,
            { id, eName },
        );
    }

    /**
     * Updates the value of an envelope.
     * @param envelopeId - The ID of the envelope to update
     * @param newValue - The new value to set
     * @param eName - The eName identifier for multi-tenant isolation
     */
    async updateEnvelopeValue<T = any>(
        envelopeId: string,
        newValue: T,
        eName: string,
    ): Promise<void> {
        if (!eName) {
            throw new Error("eName is required for updating envelope values");
        }

        const { value: storedValue, type: valueType } =
            serializeValue(newValue);

        // First verify the envelope belongs to a meta-envelope with the correct eName
        await this.runQueryInternal(
            `
      MATCH (m:MetaEnvelope { eName: $eName })-[:LINKS_TO]->(e:Envelope { id: $envelopeId })
      SET e.value = $newValue, e.valueType = $valueType
      `,
            { envelopeId, newValue: storedValue, valueType, eName },
        );
    }

    /**
     * Updates a meta-envelope and its associated envelopes.
     * @param id - The ID of the meta-envelope to update
     * @param meta - The updated meta-envelope data
     * @param acl - The updated access control list
     * @param eName - The eName identifier for multi-tenant isolation
     * @returns The updated meta-envelope and its envelopes
     */
    async updateMetaEnvelopeById<
        T extends Record<string, any> = Record<string, any>,
    >(
        id: string,
        meta: Omit<MetaEnvelope<T>, "id">,
        acl: string[],
        eName: string,
    ): Promise<StoreMetaEnvelopeResult<T>> {
        if (!eName) {
            throw new Error("eName is required for updating meta-envelopes");
        }

        try {
            let existing = await this.findMetaEnvelopeById<T>(id, eName);
            if (!existing) {
                const metaW3id = await new W3IDBuilder().build();
                await this.runQueryInternal(
                    `
                    CREATE (m:MetaEnvelope {
                        id: $id,
                        ontology: $ontology,
                        acl: $acl,
                        eName: $eName
                    })
                    `,
                    { id, ontology: meta.ontology, acl, eName },
                );
                existing = {
                    id,
                    ontology: meta.ontology,
                    acl,
                    parsed: meta.payload,
                    envelopes: [],
                };
            }

            // Update the meta-envelope properties (ensure eName matches)
            await this.runQueryInternal(
                `
                MATCH (m:MetaEnvelope { id: $id, eName: $eName })
                SET m.ontology = $ontology, m.acl = $acl
                `,
                { id, ontology: meta.ontology, acl, eName },
            );

            const createdEnvelopes: Envelope<T[keyof T]>[] = [];
            let counter = 0;

            // For each field in the new payload
            for (const [key, value] of Object.entries(meta.payload)) {
                try {
                    const { value: storedValue, type: valueType } =
                        serializeValue(value);
                    const alias = `e${counter}`;

                    // Check if an envelope with this ontology already exists
                    const existingEnvelope = existing.envelopes.find(
                        (e) => e.ontology === key,
                    );

                    if (existingEnvelope) {
                        // Update existing envelope
                        await this.runQueryInternal(
                            `
                            MATCH (e:Envelope { id: $envelopeId })
                            SET e.value = $newValue, e.valueType = $valueType
                            `,
                            {
                                envelopeId: existingEnvelope.id,
                                newValue: storedValue,
                                valueType,
                            },
                        );

                        createdEnvelopes.push({
                            id: existingEnvelope.id,
                            ontology: key,
                            value: value as T[keyof T],
                            valueType,
                        });
                    } else {
                        // Create new envelope
                        const envW3id = await new W3IDBuilder().build();
                        const envelopeId = envW3id.id;

                        await this.runQueryInternal(
                            `
                            MATCH (m:MetaEnvelope { id: $metaId, eName: $eName })
                            CREATE (${alias}:Envelope {
                                id: $${alias}_id,
                                ontology: $${alias}_ontology,
                                value: $${alias}_value,
                                valueType: $${alias}_type
                            })
                            WITH m, ${alias}
                            MERGE (m)-[:LINKS_TO]->(${alias})
                            `,
                            {
                                metaId: id,
                                eName: eName,
                                [`${alias}_id`]: envelopeId,
                                [`${alias}_ontology`]: key,
                                [`${alias}_value`]: storedValue,
                                [`${alias}_type`]: valueType,
                            },
                        );

                        createdEnvelopes.push({
                            id: envelopeId,
                            ontology: key,
                            value: value as T[keyof T],
                            valueType,
                        });
                    }

                    counter++;
                } catch (error) {
                    console.error(`Error processing field ${key}:`, error);
                    throw error;
                }
            }

            // Delete envelopes that are no longer in the payload
            const existingOntologies = new Set(Object.keys(meta.payload));
            const envelopesToDelete = existing.envelopes.filter(
                (e) => !existingOntologies.has(e.ontology),
            );

            for (const envelope of envelopesToDelete) {
                try {
                    await this.runQueryInternal(
                        `
                        MATCH (e:Envelope { id: $envelopeId })
                        DETACH DELETE e
                        `,
                        { envelopeId: envelope.id },
                    );
                } catch (error) {
                    console.error(
                        `Error deleting envelope ${envelope.id}:`,
                        error,
                    );
                    throw error;
                }
            }

            return {
                metaEnvelope: {
                    id,
                    ontology: meta.ontology,
                    acl,
                },
                envelopes: createdEnvelopes,
            };
        } catch (error) {
            console.error("Error in updateMetaEnvelopeById:", error);
            throw error;
        }
    }

    /**
     * Finds all meta-envelopes for a specific eName, regardless of ontology.
     * @param eName - The eName identifier for multi-tenant isolation
     * @returns Array of all meta-envelopes with their envelopes and parsed payload
     */
    async findAllMetaEnvelopesByEName<
        T extends Record<string, any> = Record<string, any>,
    >(eName: string): Promise<MetaEnvelopeResult<T>[]> {
        if (!eName) {
            throw new Error("eName is required for finding all meta-envelopes");
        }

        const result = await this.runQueryInternal(
            `
    MATCH (m:MetaEnvelope { eName: $eName })-[:LINKS_TO]->(e:Envelope)
    RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, collect(e) AS envelopes
    `,
            { eName },
        );

        return result.records.map((record): MetaEnvelopeResult<T> => {
            const envelopes = record
                .get("envelopes")
                .map((node: any): Envelope<T[keyof T]> => {
                    const properties = node.properties;
                    return {
                        id: properties.id,
                        ontology: properties.ontology,
                        value: deserializeValue(
                            properties.value,
                            properties.valueType,
                        ) as T[keyof T],
                        valueType: properties.valueType,
                    };
                });

            const parsed = envelopes.reduce(
                (acc: T, envelope: Envelope<T[keyof T]>) => {
                    (acc as any)[envelope.ontology] = envelope.value;
                    return acc;
                },
                {} as T,
            );

            return {
                id: record.get("id"),
                ontology: record.get("ontology"),
                acl: record.get("acl"),
                envelopes,
                parsed,
            };
        });
    }

    /**
     * Retrieves all envelopes for a specific eName.
     * @param eName - The eName identifier for multi-tenant isolation
     * @returns Array of all envelopes for the given eName
     */
    async getAllEnvelopes<T = any>(
        eName: string,
    ): Promise<GetAllEnvelopesResult<T>> {
        if (!eName) {
            throw new Error("eName is required for getting all envelopes");
        }

        const result = await this.runQueryInternal(
            `MATCH (m:MetaEnvelope { eName: $eName })-[:LINKS_TO]->(e:Envelope) RETURN e`,
            { eName },
        );
        return result.records.map((r): Envelope<T> => {
            const node = r.get("e");
            const properties = node.properties;
            return {
                id: properties.id,
                ontology: properties.ontology,
                value: deserializeValue(
                    properties.value,
                    properties.valueType,
                ) as T,
                valueType: properties.valueType,
            };
        });
    }

    /**
     * Gets all public keys for a given eName.
     * @param eName - The eName identifier
     * @returns Array of public key strings, or empty array if not found
     */
    async getPublicKeys(eName: string): Promise<string[]> {
        if (!eName) {
            throw new Error("eName is required for getting public keys");
        }

        const result = await this.runQueryInternal(
            `MATCH (u:User { eName: $eName }) RETURN u.publicKeys AS publicKeys`,
            { eName },
        );

        if (!result.records[0]) {
            return [];
        }

        const publicKeys = result.records[0].get("publicKeys");
        // Handle null/undefined and ensure we return an array
        if (!publicKeys || !Array.isArray(publicKeys)) {
            return [];
        }

        return publicKeys;
    }

    /**
     * Adds a public key to the array for a given eName (appends, avoids duplicates).
     * @param eName - The eName identifier
     * @param publicKey - The public key to add
     */
    async addPublicKey(eName: string, publicKey: string): Promise<void> {
        if (!eName) {
            throw new Error("eName is required for adding public key");
        }
        if (!publicKey) {
            throw new Error("publicKey is required");
        }

        // Use MERGE to create User if doesn't exist, then append publicKey if not already in array
        await this.runQueryInternal(
            `MERGE (u:User { eName: $eName })
             ON CREATE SET u.publicKeys = []
             WITH u
             WHERE NOT $publicKey IN u.publicKeys
             SET u.publicKeys = u.publicKeys + $publicKey`,
            { eName, publicKey },
        );
    }

    /**
     * Copies all meta-envelopes and their envelopes from this evault to a target evault instance.
     * Preserves all IDs (metaEnvelope.id, envelope.id) and the eName property.
     * This bypasses GraphQL resolvers, so no webhooks are triggered.
     * @param eName - The eName identifier for the meta-envelopes to copy
     * @param targetDbService - The DbService instance for the target evault
     * @returns The count of meta-envelopes copied
     */
    async copyMetaEnvelopesToNewEvaultInstance(
        eName: string,
        targetDbService: DbService,
    ): Promise<number> {
        if (!eName) {
            throw new Error("eName is required for copying meta-envelopes");
        }
        if (!targetDbService) {
            throw new Error("targetDbService is required");
        }

        console.log(
            `[MIGRATION] Starting copy of metaEnvelopes for eName: ${eName}`,
        );

        // Get all meta-envelopes for this eName
        const metaEnvelopes = await this.findAllMetaEnvelopesByEName(eName);
        const count = metaEnvelopes.length;

        if (count === 0) {
            console.log(
                `[MIGRATION] No metaEnvelopes found for eName: ${eName}`,
            );
            return 0;
        }

        console.log(
            `[MIGRATION] Found ${count} metaEnvelopes to copy for eName: ${eName}`,
        );

        // Copy each meta-envelope to the target evault
        for (const metaEnvelope of metaEnvelopes) {
            // Create the meta-envelope in target evault with same ID and eName
            await targetDbService.runQuery(
                `
                MERGE (m:MetaEnvelope { id: $metaId, eName: $eName })
                SET m.ontology = $ontology, m.acl = $acl
                `,
                {
                    metaId: metaEnvelope.id,
                    ontology: metaEnvelope.ontology,
                    acl: metaEnvelope.acl,
                    eName: eName,
                },
            );

            // Copy all envelopes for this meta-envelope
            for (const envelope of metaEnvelope.envelopes) {
                const { value: storedValue, type: valueType } = serializeValue(
                    envelope.value,
                );

                // Ensure value and valueType are explicitly null if undefined (Neo4j requires explicit null)
                const valueParam = storedValue !== undefined ? storedValue : null;
                const valueTypeParam = valueType !== undefined ? valueType : null;

                await targetDbService.runQuery(
                    `
                    MERGE (e:Envelope { id: $envelopeId })
                    SET e.ontology = $ontology,
                        e.value = $value,
                        e.valueType = $valueType
                    WITH e
                    MATCH (m:MetaEnvelope { id: $metaId, eName: $eName })
                    MERGE (m)-[:LINKS_TO]->(e)
                    `,
                    {
                        envelopeId: envelope.id,
                        ontology: envelope.ontology,
                        value: valueParam,
                        valueType: valueTypeParam,
                        metaId: metaEnvelope.id,
                        eName: eName,
                    },
                );
            }
        }

        // Copy User node with public keys if it exists
        try {
            const userResult = await this.runQueryInternal(
                `MATCH (u:User { eName: $eName }) RETURN u.publicKeys AS publicKeys`,
                { eName },
            );

            if (userResult.records.length > 0) {
                const publicKeys = userResult.records[0].get("publicKeys");
                if (publicKeys && Array.isArray(publicKeys) && publicKeys.length > 0) {
                    console.log(
                        `[MIGRATION] Copying User node with public keys for eName: ${eName}`,
                    );
                    await targetDbService.runQuery(
                        `MERGE (u:User { eName: $eName })
                         SET u.publicKeys = $publicKeys`,
                        { eName, publicKeys },
                    );
                    console.log(
                        `[MIGRATION] User node with public keys copied successfully`,
                    );
                }
            }
        } catch (error) {
            console.error(`[MIGRATION ERROR] Failed to copy User node:`, error);
            // Don't fail the migration if User node copy fails
        }

        // Verify envelope relationships for each metaEnvelope
        console.log(
            `[MIGRATION] Verifying envelope relationships for ${count} metaEnvelopes`,
        );
        for (const metaEnvelope of metaEnvelopes) {
            // Get envelope IDs from target
            const targetEnvelopesResult = await targetDbService.runQuery(
                `
                MATCH (m:MetaEnvelope { id: $metaId, eName: $eName })-[:LINKS_TO]->(e:Envelope)
                RETURN collect(e.id) AS envelopeIds
                `,
                { metaId: metaEnvelope.id, eName },
            );

            const targetEnvelopeIds = new Set(
                targetEnvelopesResult.records[0]?.get("envelopeIds") || [],
            );
            const sourceEnvelopeIds = new Set(
                metaEnvelope.envelopes.map((e) => e.id),
            );

            if (targetEnvelopeIds.size !== sourceEnvelopeIds.size) {
                throw new Error(
                    `Envelope count mismatch for metaEnvelope ${metaEnvelope.id}: expected ${sourceEnvelopeIds.size}, got ${targetEnvelopeIds.size}`,
                );
            }

            for (const envelopeId of sourceEnvelopeIds) {
                if (!targetEnvelopeIds.has(envelopeId)) {
                    throw new Error(
                        `Missing envelope ${envelopeId} for metaEnvelope ${metaEnvelope.id}`,
                    );
                }
            }

            console.log(
                `[MIGRATION] Verified ${sourceEnvelopeIds.size} envelopes for metaEnvelope ${metaEnvelope.id}`,
            );
        }

        console.log(
            `[MIGRATION] Successfully copied and verified ${count} metaEnvelopes with all envelopes for eName: ${eName}`,
        );

        return count;
    }

    /**
     * Gets the metaEnvelope id and ontology for an envelope by envelope id.
     * Used when logging updateEnvelopeValue (resolver only has envelopeId).
     */
    async getMetaEnvelopeIdByEnvelopeId(
        envelopeId: string,
        eName: string,
    ): Promise<{ metaEnvelopeId: string; ontology: string } | null> {
        if (!eName) {
            throw new Error("eName is required");
        }
        const result = await this.runQueryInternal(
            `
            MATCH (m:MetaEnvelope { eName: $eName })-[:LINKS_TO]->(e:Envelope { id: $envelopeId })
            RETURN m.id AS metaEnvelopeId, m.ontology AS ontology
            `,
            { envelopeId, eName },
        );
        const record = result.records[0];
        if (!record) return null;
        return {
            metaEnvelopeId: record.get("metaEnvelopeId"),
            ontology: record.get("ontology"),
        };
    }

    /**
     * Appends an envelope operation log entry (create, update, delete, update_envelope_value).
     */
    async appendEnvelopeOperationLog(
        params: AppendEnvelopeOperationLogParams,
    ): Promise<void> {
        if (!params.eName) {
            throw new Error("eName is required for envelope operation logs");
        }
        const logId = (await new W3IDBuilder().build()).id;
        const platformValue =
            params.platform !== null && params.platform !== undefined
                ? params.platform
                : null;
        await this.runQueryInternal(
            `
            CREATE (l:EnvelopeOperationLog {
                id: $id,
                eName: $eName,
                metaEnvelopeId: $metaEnvelopeId,
                envelopeHash: $envelopeHash,
                operation: $operation,
                platform: $platform,
                timestamp: $timestamp,
                ontology: $ontology
            })
            `,
            {
                id: logId,
                eName: params.eName,
                metaEnvelopeId: params.metaEnvelopeId,
                envelopeHash: params.envelopeHash,
                operation: params.operation,
                platform: platformValue,
                timestamp: params.timestamp,
                ontology: params.ontology ?? null,
            },
        );
    }

    /**
     * Returns paginated envelope operation logs for an eName.
     * Ordered by timestamp DESC, then id ASC for stable cursor pagination.
     */
    async getEnvelopeOperationLogs(
        eName: string,
        options: { limit: number; cursor?: string | null },
    ): Promise<GetEnvelopeOperationLogsResult> {
        if (!eName) {
            throw new Error("eName is required for getting envelope operation logs");
        }
        const limit = Math.min(Math.max(1, options.limit || 20), 100);
        const cursor = options.cursor ?? null;

        // Fetch limit+1 to know if there's a next page. Cursor format: "timestamp|id" (| avoids colons in ISO timestamp).
        const [cursorTs = "", cursorId = ""] = cursor
            ? cursor.split("|")
            : [];
        const result = await this.runQueryInternal(
            cursor
                ? `
            MATCH (l:EnvelopeOperationLog { eName: $eName })
            WHERE (l.timestamp < $cursorTs) OR (l.timestamp = $cursorTs AND l.id > $cursorId)
            WITH l
            ORDER BY l.timestamp DESC, l.id ASC
            LIMIT $limitPlusOne
            RETURN l.id AS id, l.eName AS eName, l.metaEnvelopeId AS metaEnvelopeId,
                   l.envelopeHash AS envelopeHash, l.operation AS operation,
                   l.platform AS platform, l.timestamp AS timestamp, l.ontology AS ontology
            `
                : `
            MATCH (l:EnvelopeOperationLog { eName: $eName })
            WITH l
            ORDER BY l.timestamp DESC, l.id ASC
            LIMIT $limitPlusOne
            RETURN l.id AS id, l.eName AS eName, l.metaEnvelopeId AS metaEnvelopeId,
                   l.envelopeHash AS envelopeHash, l.operation AS operation,
                   l.platform AS platform, l.timestamp AS timestamp, l.ontology AS ontology
            `,
            cursor
                ? {
                      eName,
                      limitPlusOne: neo4j.int(limit + 1),
                      cursorTs,
                      cursorId,
                  }
                : { eName, limitPlusOne: neo4j.int(limit + 1) },
        );

        const rows = result.records.map((r) => ({
            id: r.get("id"),
            eName: r.get("eName"),
            metaEnvelopeId: r.get("metaEnvelopeId"),
            envelopeHash: r.get("envelopeHash"),
            operation: r.get("operation"),
            platform: r.get("platform"),
            timestamp: r.get("timestamp"),
            ontology: r.get("ontology"),
        }));

        const hasMore = rows.length > limit;
        const logs = (hasMore ? rows.slice(0, limit) : rows).map(
            (r): EnvelopeOperationLogEntry => ({
                id: r.id,
                eName: r.eName,
                metaEnvelopeId: r.metaEnvelopeId,
                envelopeHash: r.envelopeHash,
                operation: r.operation,
                platform: r.platform,
                timestamp: r.timestamp,
                ...(r.ontology != null && { ontology: r.ontology }),
            }),
        );

        const last = logs[logs.length - 1];
        const nextCursor =
            hasMore && last
                ? `${last.timestamp}|${last.id}`
                : null;

        return { logs, nextCursor, hasMore };
    }

    /**
     * Finds meta-envelopes with Relay-style cursor pagination and optional filtering.
     * Supports filtering by ontology and searching within envelope values.
     * @param eName - The eName identifier for multi-tenant isolation
     * @param options - Pagination and filter options
     * @returns A connection object with edges, pageInfo, and totalCount
     */
    async findMetaEnvelopesPaginated<
        T extends Record<string, any> = Record<string, any>,
    >(
        eName: string,
        options: FindMetaEnvelopesPaginatedOptions = {},
    ): Promise<MetaEnvelopeConnection<T>> {
        if (!eName) {
            throw new Error("eName is required for finding meta-envelopes");
        }

        const { filter, first, after, last, before } = options;

        // Validate pagination parameters
        if (first !== undefined && last !== undefined) {
            throw new Error("Cannot specify both 'first' and 'last'");
        }
        if (after !== undefined && before !== undefined) {
            throw new Error("Cannot specify both 'after' and 'before'");
        }

        // Default limit
        const limit = Math.min(
            Math.max(1, first ?? last ?? 20),
            100,
        );
        const isBackward = last !== undefined;

        // Build WHERE conditions
        const conditions: string[] = ["m.eName = $eName"];
        const params: Record<string, any> = { eName };

        // Filter by ontology
        if (filter?.ontologyId) {
            conditions.push("m.ontology = $ontologyId");
            params.ontologyId = filter.ontologyId;
        }

        // Build search condition if provided
        let searchCondition = "";
        if (filter?.search?.term) {
            const search = filter.search;
            const caseSensitive = search.caseSensitive ?? false;
            const mode = search.mode ?? "CONTAINS";
            const fields = search.fields;

            // Build the value match expression based on mode
            let matchExpr: string;
            if (caseSensitive) {
                switch (mode) {
                    case "EXACT":
                        matchExpr = "e.value = $searchTerm";
                        break;
                    case "STARTS_WITH":
                        matchExpr = "e.value STARTS WITH $searchTerm";
                        break;
                    default:
                        // CONTAINS is the default mode
                        matchExpr = "e.value CONTAINS $searchTerm";
                        break;
                }
            } else {
                switch (mode) {
                    case "EXACT":
                        matchExpr = "toLower(toString(e.value)) = toLower($searchTerm)";
                        break;
                    case "STARTS_WITH":
                        matchExpr = "toLower(toString(e.value)) STARTS WITH toLower($searchTerm)";
                        break;
                    default:
                        // CONTAINS is the default mode
                        matchExpr = "toLower(toString(e.value)) CONTAINS toLower($searchTerm)";
                        break;
                }
            }

            params.searchTerm = search.term;

            // Add field restriction if specified
            if (fields && fields.length > 0) {
                params.searchFields = fields;
                searchCondition = `
                    AND EXISTS {
                        MATCH (m)-[:LINKS_TO]->(e:Envelope)
                        WHERE e.ontology IN $searchFields AND ${matchExpr}
                    }
                `;
            } else {
                searchCondition = `
                    AND EXISTS {
                        MATCH (m)-[:LINKS_TO]->(e:Envelope)
                        WHERE ${matchExpr}
                    }
                `;
            }
        }

        // Handle cursor pagination
        let cursorCondition = "";
        if (after) {
            // Decode cursor (format: base64 encoded "id")
            const cursorId = Buffer.from(after, "base64").toString("utf-8");
            params.cursorId = cursorId;
            cursorCondition = isBackward
                ? "AND m.id < $cursorId"
                : "AND m.id > $cursorId";
        } else if (before) {
            const cursorId = Buffer.from(before, "base64").toString("utf-8");
            params.cursorId = cursorId;
            cursorCondition = isBackward
                ? "AND m.id > $cursorId"
                : "AND m.id < $cursorId";
        }

        // Get total count (without pagination)
        const countQuery = `
            MATCH (m:MetaEnvelope)
            WHERE ${conditions.join(" AND ")}
            ${searchCondition}
            RETURN count(m) AS total
        `;
        const countResult = await this.runQueryInternal(countQuery, params);
        const totalCount = countResult.records[0]?.get("total")?.toNumber?.() ?? 
                          countResult.records[0]?.get("total") ?? 0;

        // Build main query with pagination
        const orderDirection = isBackward ? "DESC" : "ASC";
        const mainQuery = `
            MATCH (m:MetaEnvelope)
            WHERE ${conditions.join(" AND ")}
            ${searchCondition}
            ${cursorCondition}
            WITH m
            ORDER BY m.id ${orderDirection}
            LIMIT $limitPlusOne
            MATCH (m)-[:LINKS_TO]->(e:Envelope)
            RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, collect(e) AS envelopes
        `;

        params.limitPlusOne = neo4j.int(limit + 1);
        const result = await this.runQueryInternal(mainQuery, params);

        // Process results
        let records = result.records;
        const hasExtraRecord = records.length > limit;
        if (hasExtraRecord) {
            records = records.slice(0, limit);
        }

        // Reverse if backward pagination to maintain correct order
        if (isBackward) {
            records = records.reverse();
        }

        // Build edges
        const edges: MetaEnvelopeEdge<T>[] = records.map((record) => {
            const envelopes = record
                .get("envelopes")
                .map((node: any): Envelope<T[keyof T]> => {
                    const properties = node.properties;
                    return {
                        id: properties.id,
                        ontology: properties.ontology,
                        value: deserializeValue(
                            properties.value,
                            properties.valueType,
                        ) as T[keyof T],
                        valueType: properties.valueType,
                    };
                });

            const parsed = envelopes.reduce(
                (acc: T, envelope: Envelope<T[keyof T]>) => {
                    (acc as any)[envelope.ontology] = envelope.value;
                    return acc;
                },
                {} as T,
            );

            const id = record.get("id");
            const node: MetaEnvelopeResult<T> = {
                id,
                ontology: record.get("ontology"),
                acl: record.get("acl"),
                envelopes,
                parsed,
            };

            return {
                cursor: Buffer.from(id).toString("base64"),
                node,
            };
        });

        // Build pageInfo
        const pageInfo: PageInfo = {
            hasNextPage: isBackward ? (after !== undefined) : hasExtraRecord,
            hasPreviousPage: isBackward ? hasExtraRecord : (after !== undefined),
            startCursor: edges.length > 0 ? edges[0].cursor : null,
            endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        };

        return {
            edges,
            pageInfo,
            totalCount,
        };
    }

    /**
     * Closes the database connection.
     */
    async close(): Promise<void> {
        await this.driver.close();
    }
}
