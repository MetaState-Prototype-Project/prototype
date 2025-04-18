import { Driver } from "neo4j-driver";
import { W3IDBuilder } from "w3id";
import { serializeValue, deserializeValue } from "./schema";
import {
    MetaEnvelope,
    Envelope,
    MetaEnvelopeResult,
    StoreMetaEnvelopeResult,
    SearchMetaEnvelopesResult,
    GetAllEnvelopesResult,
} from "./types";

/**
 * Service for managing meta-envelopes and their associated envelopes in Neo4j.
 * Provides functionality for storing, retrieving, searching, and updating data
 * with proper type handling and access control.
 */
export class DbService {
    /**
     * Creates a new instance of the DbService.
     * @param driver - The Neo4j driver instance
     */
    constructor(private driver: Driver) {}

    /**
     * Executes a Cypher query with the given parameters.
     * @param query - The Cypher query to execute
     * @param params - The parameters for the query
     * @returns The result of the query execution
     */
    private async runQuery(query: string, params: Record<string, any>) {
        const session = this.driver.session();
        try {
            return await session.run(query, params);
        } finally {
            await session.close();
        }
    }

    /**
     * Stores a new meta-envelope and its associated envelopes.
     * @param meta - The meta-envelope data (without ID)
     * @param acl - The access control list for the meta-envelope
     * @returns The created meta-envelope and its envelopes
     */
    async storeMetaEnvelope<
        T extends Record<string, any> = Record<string, any>,
    >(
        meta: Omit<MetaEnvelope<T>, "id">,
        acl: string[],
    ): Promise<StoreMetaEnvelopeResult<T>> {
        const w3id = await new W3IDBuilder().build();

        const cypher: string[] = [
            `CREATE (m:MetaEnvelope { id: $metaId, ontology: $ontology, acl: $acl })`,
        ];

        const envelopeParams: Record<string, any> = {
            metaId: w3id.id,
            ontology: meta.ontology,
            acl: acl,
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

        await this.runQuery(cypher.join("\n"), envelopeParams);

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
     * @returns Array of matched meta-envelopes with their complete envelope sets
     */
    async findMetaEnvelopesBySearchTerm<
        T extends Record<string, any> = Record<string, any>,
    >(
        ontology: string,
        searchTerm: string,
    ): Promise<SearchMetaEnvelopesResult<T>> {
        const result = await this.runQuery(
            `
    MATCH (m:MetaEnvelope { ontology: $ontology })-[:LINKS_TO]->(e:Envelope)
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
            { ontology, term: searchTerm },
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
     * Finds a meta-envelope by its ID.
     * @param id - The ID of the meta-envelope to find
     * @returns The meta-envelope with all its envelopes and parsed payload, or null if not found
     */
    async findMetaEnvelopeById<
        T extends Record<string, any> = Record<string, any>,
    >(id: string): Promise<MetaEnvelopeResult<T> | null> {
        const result = await this.runQuery(
            `
      MATCH (m:MetaEnvelope { id: $id })-[:LINKS_TO]->(e:Envelope)
      RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, collect(e) AS envelopes
      `,
            { id },
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
     * Finds all meta-envelope IDs for a given ontology.
     * @param ontology - The ontology to search for
     * @returns Array of meta-envelope IDs
     */
    async findMetaEnvelopesByOntology(ontology: string): Promise<string[]> {
        const result = await this.runQuery(
            `
      MATCH (m:MetaEnvelope { ontology: $ontology })
      RETURN m.id AS id
      `,
            { ontology },
        );

        return result.records.map((r) => r.get("id"));
    }

    /**
     * Deletes a meta-envelope and all its associated envelopes.
     * @param id - The ID of the meta-envelope to delete
     */
    async deleteMetaEnvelope(id: string): Promise<void> {
        await this.runQuery(
            `
      MATCH (m:MetaEnvelope { id: $id })-[:LINKS_TO]->(e:Envelope)
      DETACH DELETE m, e
      `,
            { id },
        );
    }

    /**
     * Updates the value of an envelope.
     * @param envelopeId - The ID of the envelope to update
     * @param newValue - The new value to set
     */
    async updateEnvelopeValue<T = any>(
        envelopeId: string,
        newValue: T,
    ): Promise<void> {
        const { value: storedValue, type: valueType } =
            serializeValue(newValue);

        await this.runQuery(
            `
      MATCH (e:Envelope { id: $envelopeId })
      SET e.value = $newValue, e.valueType = $valueType
      `,
            { envelopeId, newValue: storedValue, valueType },
        );
    }

    /**
     * Retrieves all envelopes in the system.
     * @returns Array of all envelopes
     */
    async getAllEnvelopes<T = any>(): Promise<GetAllEnvelopesResult<T>> {
        const result = await this.runQuery(`MATCH (e:Envelope) RETURN e`, {});
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
     * Closes the database connection.
     */
    async close(): Promise<void> {
        await this.driver.close();
    }
}
