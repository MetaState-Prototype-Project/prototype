import type { Driver } from "neo4j-driver";
import { W3IDBuilder } from "w3id";
import { deserializeValue, serializeValue } from "./schema";
import type {
    Envelope,
    GetAllEnvelopesResult,
    MetaEnvelope,
    MetaEnvelopeResult,
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
     * Gets the public key for a given eName.
     * @param eName - The eName identifier
     * @returns The public key string, or null if not found
     */
    async getPublicKey(eName: string): Promise<string | null> {
        if (!eName) {
            throw new Error("eName is required for getting public key");
        }

        const result = await this.runQueryInternal(
            `MATCH (u:User { eName: $eName }) RETURN u.publicKey AS publicKey`,
            { eName },
        );

        if (!result.records[0]) {
            return null;
        }

        return result.records[0].get("publicKey") || null;
    }

    /**
     * Sets or updates the public key for a given eName.
     * @param eName - The eName identifier
     * @param publicKey - The public key to store
     */
    async setPublicKey(eName: string, publicKey: string): Promise<void> {
        if (!eName) {
            throw new Error("eName is required for setting public key");
        }
        if (!publicKey) {
            throw new Error("publicKey is required");
        }

        await this.runQueryInternal(
            `MERGE (u:User { eName: $eName })
             SET u.publicKey = $publicKey`,
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

        // Copy User node with public key if it exists
        try {
            const userResult = await this.runQueryInternal(
                `MATCH (u:User { eName: $eName }) RETURN u.publicKey AS publicKey`,
                { eName },
            );

            if (userResult.records.length > 0) {
                const publicKey = userResult.records[0].get("publicKey");
                if (publicKey) {
                    console.log(
                        `[MIGRATION] Copying User node with public key for eName: ${eName}`,
                    );
                    await targetDbService.runQuery(
                        `MERGE (u:User { eName: $eName })
                         SET u.publicKey = $publicKey`,
                        { eName, publicKey },
                    );
                    console.log(
                        `[MIGRATION] User node with public key copied successfully`,
                    );
                }
            }
        } catch (error) {
            console.error(`[MIGRATION ERROR] Failed to copy User node:`, error);
            // Don't fail the migration if User node copy fails
        }

        console.log(
            `[MIGRATION] Successfully copied ${count} metaEnvelopes for eName: ${eName}`,
        );

        return count;
    }

    /**
     * Closes the database connection.
     */
    async close(): Promise<void> {
        await this.driver.close();
    }
}
