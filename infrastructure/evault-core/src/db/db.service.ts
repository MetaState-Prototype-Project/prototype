import neo4j, { Driver, Session } from "neo4j-driver";
import { W3IDBuilder } from "w3id";

type MetaEnvelope = {
    ontology: string;
    payload: Record<string, any>;
    acl: string[];
};

type Envelope = {
    id: string;
    value: any;
    ontology: string;
};

export class DbService {
    private driver: Driver;

    constructor(uri: string, user: string, password: string) {
        this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    }

    private async runQuery(query: string, params: Record<string, any>) {
        const session = this.driver.session();
        try {
            return await session.run(query, params);
        } finally {
            await session.close();
        }
    }

    async storeMetaEnvelope(meta: Omit<MetaEnvelope, "id">, acl: string[]) {
        const w3id = await new W3IDBuilder().build();

        const cypher: string[] = [
            `CREATE (m:MetaEnvelope { id: $metaId, ontology: $ontology, acl: $acl })`,
        ];

        const envelopeParams: Record<string, any> = {
            metaId: w3id.id,
            ontology: meta.ontology,
            acl: acl,
        };

        const createdEnvelopes: Envelope[] = [];
        let counter = 0;

        for (const [key, value] of Object.entries(meta.payload)) {
            const envW3id = await new W3IDBuilder().build();
            const envelopeId = envW3id.id;
            const alias = `e${counter}`;

            const storedValue =
                typeof value === "object" ? JSON.stringify(value) : value;

            cypher.push(`
      CREATE (${alias}:Envelope {
        id: $${alias}_id,
        ontology: $${alias}_ontology,
        value: $${alias}_value
      })
      WITH m, ${alias}
      MERGE (m)-[:LINKS_TO]->(${alias})
    `);

            envelopeParams[`${alias}_id`] = envelopeId;
            envelopeParams[`${alias}_ontology`] = key;
            envelopeParams[`${alias}_value`] = storedValue;

            createdEnvelopes.push({
                id: envelopeId,
                ontology: key,
                value: value,
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

    async findMetaEnvelopesBySearchTerm(
        ontology: string,
        searchTerm: string,
    ): Promise<{ id: string; envelopes: any[] }[]> {
        const result = await this.runQuery(
            `
    MATCH (m:MetaEnvelope { ontology: $ontology })-[:LINKS_TO]->(e:Envelope)
    WHERE toLower(e.value) CONTAINS toLower($term)
    RETURN m.id AS id, collect(e) AS envelopes
    `,
            { ontology, term: searchTerm },
        );

        return result.records.map((record) => ({
            id: record.get("id"),
            envelopes: record.get("envelopes").map((node: any) => ({
                id: node.properties.id,
                ontology: node.properties.ontology,
                value: node.properties.value,
            })),
        }));
    }

    async findMetaEnvelopeById(id: string): Promise<any> {
        const result = await this.runQuery(
            `
      MATCH (m:MetaEnvelope { id: $id })-[:LINKS_TO]->(e:Envelope)
      RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, collect(e) AS envelopes
      `,
            { id },
        );

        if (!result.records[0]) return null;

        const record = result.records[0];
        return {
            id: record.get("id"),
            ontology: record.get("ontology"),
            acl: record.get("acl"),
            envelopes: record.get("envelopes").map((node: any) => ({
                id: node.properties.id,
                ontology: node.properties.ontology,
                value: node.properties.value,
            })),
        };
    }

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

    async deleteMetaEnvelope(id: string): Promise<void> {
        await this.runQuery(
            `
      MATCH (m:MetaEnvelope { id: $id })-[:LINKS_TO]->(e:Envelope)
      DETACH DELETE m, e
      `,
            { id },
        );
    }

    async updateEnvelopeValue(
        envelopeId: string,
        newValue: any,
    ): Promise<void> {
        await this.runQuery(
            `
      MATCH (e:Envelope { id: $envelopeId })
      SET e.value = $newValue
      `,
            { envelopeId, newValue },
        );
    }

    async getAllEnvelopes(): Promise<Envelope[]> {
        const result = await this.runQuery(`MATCH (e:Envelope) RETURN e`, {});
        return result.records.map((r) => {
            const node = r.get("e");
            return {
                id: node.properties.id,
                ontology: node.properties.ontology,
                value: node.properties.value,
            };
        });
    }

    async close(): Promise<void> {
        await this.driver.close();
    }
}
