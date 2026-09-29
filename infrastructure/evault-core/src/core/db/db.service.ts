import neo4j, { type Driver, type ManagedTransaction } from "neo4j-driver";
import { randomUUID } from "node:crypto";
import { W3IDBuilder } from "w3id";
import { timed } from "../utils/timing";
import { parseStoredAclBlock, serializeAclBlock } from "../acl";
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
    MetaEnvelopeVersion,
    MetaEnvelopeVersionConnection,
    PageInfo,
    SearchMetaEnvelopesResult,
    StoreMetaEnvelopeResult,
} from "./types";

export interface AwarenessWriteContext {
    evaultPublicKey: string | null;
    requestingPlatform?: string | null;
    /** The party the write is recorded against, when the caller named one. */
    author?: string | null;
    skipAwareness?: boolean;
}

/** Who made a write, as recorded in the record's history. */
interface WriteOrigin {
    requestingPlatform: string | null;
    author: string | null;
}

function writeOrigin(awareness?: AwarenessWriteContext): WriteOrigin {
    return {
        requestingPlatform: awareness?.requestingPlatform ?? null,
        author: awareness?.author ?? null,
    };
}

function awarenessOutboxParams(
    packetId: string,
    schemaId: string,
    eName: string,
    data: unknown,
    operation: "create" | "update" | "delete",
    context: AwarenessWriteContext,
): Record<string, unknown> {
    return {
        awarenessEventId: randomUUID(),
        awarenessPacketId: packetId,
        awarenessSchemaId: schemaId,
        awarenessW3id: eName,
        awarenessEvaultPublicKey: context.evaultPublicKey,
        awarenessDataJson: JSON.stringify(data ?? null),
        awarenessOperation: operation,
        awarenessRequestingPlatform: context.requestingPlatform ?? null,
        awarenessOccurredAt: new Date().toISOString(),
        awarenessNow: Date.now(),
    };
}

const CREATE_AWARENESS_OUTBOX = `
    WITH m
    MERGE (s:AwarenessStream { packetId: $awarenessPacketId })
    SET s.version = coalesce(s.version, 0) + 1
    CREATE (a:AwarenessOutbox {
        eventId: $awarenessEventId,
        packetId: $awarenessPacketId,
        schemaId: $awarenessSchemaId,
        w3id: $awarenessW3id,
        evaultPublicKey: $awarenessEvaultPublicKey,
        dataJson: $awarenessDataJson,
        operation: $awarenessOperation,
        requestingPlatform: $awarenessRequestingPlatform,
        occurredAt: $awarenessOccurredAt,
        streamVersion: s.version,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: $awarenessNow,
        createdAt: $awarenessNow
    })
`;

export type MetaEnvelopeVersionOperation = "create" | "update" | "delete";

/**
 * The full state of a MetaEnvelope at one point in time. `payload` is null for
 * a delete, which records that the record was pruned rather than a new state.
 */
interface MetaEnvelopeSnapshot {
    ontology: string;
    acl: string[];
    aclBlock: string | null;
    payload: Record<string, unknown> | null;
}

/**
 * The payload with each field's stored value and type, so a rollback can put
 * back exactly what was there (a date stays a date) rather than its JSON form.
 */
function typedFieldsJson(payload: Record<string, unknown> | null): string | null {
    if (payload === null) return null;
    const fields: Record<string, { value: unknown; valueType: string }> = {};
    for (const [key, value] of Object.entries(payload)) {
        const { value: stored, type } = serializeValue(value);
        fields[key] = { value: stored ?? null, valueType: type };
    }
    return JSON.stringify(fields);
}

function metaEnvelopeVersionParams(
    metaEnvelopeId: string,
    eName: string,
    operation: MetaEnvelopeVersionOperation,
    snapshot: MetaEnvelopeSnapshot,
    origin: WriteOrigin,
    restoredFromVersion: number | null = null,
): Record<string, unknown> {
    return {
        versionMetaEnvelopeId: metaEnvelopeId,
        versionEName: eName,
        versionOperation: operation,
        versionOntology: snapshot.ontology,
        versionAcl: snapshot.acl ?? [],
        versionAclBlock: snapshot.aclBlock ?? null,
        versionPayloadJson:
            snapshot.payload === null ? null : JSON.stringify(snapshot.payload),
        versionFieldsJson: typedFieldsJson(snapshot.payload),
        versionRequestingPlatform: origin.requestingPlatform,
        versionAuthor: origin.author,
        versionRestoredFromVersion:
            restoredFromVersion === null ? null : neo4j.int(restoredFromVersion),
        versionCreatedAt: new Date().toISOString(),
        versionNow: Date.now(),
    };
}

// Every write to a MetaEnvelope appends an immutable snapshot of its resulting
// state. History lives on its own nodes keyed by (metaEnvelopeId, eName) and is
// never linked into the MetaEnvelope graph, so live reads are unaffected and
// the history outlives pruning and re-creation of the record.
const APPEND_METAENVELOPE_VERSION = `
    MERGE (h:MetaEnvelopeHistory { metaEnvelopeId: $versionMetaEnvelopeId, eName: $versionEName })
    ON CREATE SET h.createdAt = $versionNow
    SET h.latestVersion = coalesce(h.latestVersion, 0) + 1, h.updatedAt = $versionNow
    CREATE (:MetaEnvelopeVersion {
        metaEnvelopeId: $versionMetaEnvelopeId,
        eName: $versionEName,
        version: h.latestVersion,
        operation: $versionOperation,
        ontology: $versionOntology,
        acl: $versionAcl,
        aclBlock: $versionAclBlock,
        payloadJson: $versionPayloadJson,
        fieldsJson: $versionFieldsJson,
        requestingPlatform: $versionRequestingPlatform,
        author: $versionAuthor,
        restoredFromVersion: $versionRestoredFromVersion,
        createdAt: $versionCreatedAt
    })
`;

export type MetaEnvelopeRollbackErrorCode =
    | "INVALID_VERSION"
    | "VERSION_NOT_FOUND"
    | "VERSION_IS_DELETE";

export class MetaEnvelopeRollbackError extends Error {
    constructor(
        readonly code: MetaEnvelopeRollbackErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "MetaEnvelopeRollbackError";
    }
}

export interface MetaEnvelopeRollbackResult {
    metaEnvelope: MetaEnvelopeResult;
    /** "create" when the rollback brought a pruned record back. */
    operation: "create" | "update";
    /** The version the rollback was recorded as. */
    version: number;
    restoredFromVersion: number;
}

/**
 * The stored value and type of each field of a recorded version. Versions
 * written before typed fields were recorded only have their JSON payload, so
 * their types are re-derived from it (a date comes back as its ISO string).
 */
function restorableFields(
    fieldsJson: string | null,
    payloadJson: string | null,
): Record<string, { value: unknown; valueType: string }> {
    if (fieldsJson) return JSON.parse(fieldsJson);
    const payload: Record<string, unknown> = payloadJson
        ? JSON.parse(payloadJson)
        : {};
    const fields: Record<string, { value: unknown; valueType: string }> = {};
    for (const [key, value] of Object.entries(payload)) {
        const { value: stored, type } = serializeValue(value);
        fields[key] = { value: stored ?? null, valueType: type };
    }
    return fields;
}

function toNumberOrNull(value: any): number | null {
    if (value === null || value === undefined) return null;
    return typeof value.toNumber === "function" ? value.toNumber() : Number(value);
}

function payloadFromEnvelopeNodes(nodes: any[]): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const node of nodes) {
        if (!node) continue;
        payload[node.properties.ontology] = deserializeValue(
            node.properties.value,
            node.properties.valueType,
        );
    }
    return payload;
}

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
        const firstLine = query.trim().split("\n")[0].slice(0, 80);
        return timed(`db.query "${firstLine}"`, async () => {
            const session = this.driver.session();
            try {
                return await session.run(query, params);
            } finally {
                await session.close();
            }
        });
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
     * Takes the write lock on a record's history and returns its latest
     * version (0 when none has been recorded yet). Every writer locks the
     * history before touching the record, so snapshots are appended in the
     * order the writes land.
     */
    private async lockHistory(
        tx: ManagedTransaction,
        metaEnvelopeId: string,
        eName: string,
    ): Promise<number> {
        const result = await tx.run(
            `
            MERGE (h:MetaEnvelopeHistory { metaEnvelopeId: $metaEnvelopeId, eName: $eName })
            ON CREATE SET h.createdAt = $now, h.latestVersion = 0
            SET h.updatedAt = $now
            RETURN h.latestVersion AS latestVersion
            `,
            { metaEnvelopeId, eName, now: Date.now() },
        );
        const latest = result.records[0]?.get("latestVersion");
        return typeof latest?.toNumber === "function"
            ? latest.toNumber()
            : Number(latest ?? 0);
    }

    /**
     * Reads the live state of a record inside a transaction, or null when no
     * live record exists for the id and eName.
     */
    private async readLiveSnapshot(
        tx: ManagedTransaction,
        metaEnvelopeId: string,
        eName: string,
    ): Promise<MetaEnvelopeSnapshot | null> {
        const result = await tx.run(
            `
            MATCH (m:MetaEnvelope { id: $metaEnvelopeId, eName: $eName })
            OPTIONAL MATCH (m)-[:LINKS_TO]->(e:Envelope)
            RETURN m.ontology AS ontology, m.acl AS acl, m.aclBlock AS aclBlock, collect(e) AS envelopes
            `,
            { metaEnvelopeId, eName },
        );
        const record = result.records[0];
        if (!record) return null;
        return {
            ontology: record.get("ontology"),
            acl: record.get("acl") ?? [],
            aclBlock: record.get("aclBlock") ?? null,
            payload: payloadFromEnvelopeNodes(record.get("envelopes")),
        };
    }

    private async appendVersion(
        tx: ManagedTransaction,
        metaEnvelopeId: string,
        eName: string,
        operation: MetaEnvelopeVersionOperation,
        snapshot: MetaEnvelopeSnapshot,
        origin: WriteOrigin,
        restoredFromVersion: number | null = null,
    ): Promise<void> {
        await tx.run(
            APPEND_METAENVELOPE_VERSION,
            metaEnvelopeVersionParams(
                metaEnvelopeId,
                eName,
                operation,
                snapshot,
                origin,
                restoredFromVersion,
            ),
        );
    }

    /**
     * Locks a record's history and returns its live state before the caller
     * changes it. A record written before versioning existed has no history,
     * so its current state is recorded first as the baseline it started from.
     */
    private async prepareVersionedWrite(
        tx: ManagedTransaction,
        metaEnvelopeId: string,
        eName: string,
    ): Promise<MetaEnvelopeSnapshot | null> {
        const latestVersion = await this.lockHistory(tx, metaEnvelopeId, eName);
        const live = await this.readLiveSnapshot(tx, metaEnvelopeId, eName);
        if (latestVersion === 0 && live) {
            // Who wrote the pre-existing state is unknown; it is not this caller.
            await this.appendVersion(tx, metaEnvelopeId, eName, "create", live, {
                requestingPlatform: null,
                author: null,
            });
        }
        return live;
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
        awareness?: AwarenessWriteContext,
    ): Promise<StoreMetaEnvelopeResult<T>> {
        return timed("db.storeMetaEnvelope", async () => {
            if (!eName) {
                throw new Error("eName is required for storing meta-envelopes");
            }

            const w3id = await timed("db.storeMetaEnvelope.buildMetaId", () =>
                new W3IDBuilder().build(),
            );

            const cypher: string[] = [
                `CREATE (m:MetaEnvelope { id: $metaId, ontology: $ontology, acl: $acl, aclBlock: $aclBlock, eName: $eName })`,
            ];

            const envelopeParams: Record<string, any> = {
                metaId: w3id.id,
                ontology: meta.ontology,
                acl: acl,
                aclBlock: serializeAclBlock(meta._acl),
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

            cypher.push("WITH m", APPEND_METAENVELOPE_VERSION);
            Object.assign(
                envelopeParams,
                metaEnvelopeVersionParams(
                    w3id.id,
                    eName,
                    "create",
                    {
                        ontology: meta.ontology,
                        acl,
                        aclBlock: envelopeParams.aclBlock ?? null,
                        payload: meta.payload,
                    },
                    writeOrigin(awareness),
                ),
            );

            if (awareness && !awareness.skipAwareness) {
                cypher.push(CREATE_AWARENESS_OUTBOX);
                Object.assign(
                    envelopeParams,
                    awarenessOutboxParams(
                        w3id.id,
                        meta.ontology,
                        eName,
                        meta.payload,
                        "create",
                        awareness,
                    ),
                );
            }

            await timed("db.storeMetaEnvelope.runQuery", () =>
                this.runQueryInternal(cypher.join("\n"), envelopeParams),
            );

            return {
                metaEnvelope: {
                    id: w3id.id,
                    ontology: meta.ontology,
                    acl: acl,
                    _acl: meta._acl,
                },
                envelopes: createdEnvelopes,
            };
        });
    }

    /**
     * Store a meta-envelope with a specific ID (for migrations)
     * Similar to storeMetaEnvelope but allows preserving the original ID
     * @param meta - The meta-envelope data (without id)
     * @param acl - Access control list
     * @param eName - The eName identifier for multi-tenant isolation
     * @param id - Optional ID to use (if not provided, generates new one)
     * @returns The stored meta-envelope with its envelopes
     */
    async storeMetaEnvelopeWithId<
        T extends Record<string, any> = Record<string, any>,
    >(
        meta: Omit<MetaEnvelope<T>, "id">,
        acl: string[],
        eName: string,
        id?: string,
        awareness?: AwarenessWriteContext,
    ): Promise<StoreMetaEnvelopeResult<T>> {
        if (!eName) {
            throw new Error("eName is required for storing meta-envelopes");
        }

        // Use provided ID or generate new one
        const metaId = id || (await new W3IDBuilder().build()).id;

        const cypher: string[] = [
            "MERGE (m:MetaEnvelope { id: $metaId })",
            "ON CREATE SET m.ontology = $ontology, m.acl = $acl, m.aclBlock = $aclBlock, m.eName = $eName",
        ];

        const envelopeParams: Record<string, any> = {
            metaId: metaId,
            ontology: meta.ontology,
            acl: acl,
            aclBlock: serializeAclBlock(meta._acl),
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
      MERGE (${alias}:Envelope { id: $${alias}_id })
      ON CREATE SET ${alias}.ontology = $${alias}_ontology, ${alias}.value = $${alias}_value, ${alias}.valueType = $${alias}_type
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

        if (awareness && !awareness.skipAwareness) {
            cypher.push(CREATE_AWARENESS_OUTBOX);
            Object.assign(
                envelopeParams,
                awarenessOutboxParams(
                    metaId,
                    meta.ontology,
                    eName,
                    meta.payload,
                    "create",
                    awareness,
                ),
            );
        }

        const origin = writeOrigin(awareness);
        const session = this.driver.session();
        try {
            await session.executeWrite(async (tx) => {
                // The MERGE only matches on id, so a re-run against an existing
                // record adds to it rather than creating it; version it as an
                // update of that record's owner.
                const existing = await tx.run(
                    "MATCH (m:MetaEnvelope { id: $metaId }) RETURN m.eName AS eName LIMIT 1",
                    { metaId },
                );
                const existed = existing.records.length > 0;
                const historyEName: string =
                    existing.records[0]?.get("eName") ?? eName;
                if (existed) {
                    await this.prepareVersionedWrite(tx, metaId, historyEName);
                }

                await tx.run(cypher.join("\n"), envelopeParams);

                if (!existed) {
                    await this.appendVersion(
                        tx,
                        metaId,
                        eName,
                        "create",
                        {
                            ontology: meta.ontology,
                            acl,
                            aclBlock: envelopeParams.aclBlock ?? null,
                            payload: meta.payload,
                        },
                        origin,
                    );
                    return;
                }
                const live = await this.readLiveSnapshot(
                    tx,
                    metaId,
                    historyEName,
                );
                if (live) {
                    await this.appendVersion(
                        tx,
                        metaId,
                        historyEName,
                        "update",
                        live,
                        origin,
                    );
                }
            });
        } finally {
            await session.close();
        }

        return {
            metaEnvelope: {
                id: metaId,
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
    RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, m.aclBlock AS aclBlock, collect(allEnvelopes) AS envelopes
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
                _acl: parseStoredAclBlock(record.get("aclBlock")),
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
    RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, m.aclBlock AS aclBlock, collect(e) AS envelopes
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
                _acl: parseStoredAclBlock(record.get("aclBlock")),
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
      RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, m.aclBlock AS aclBlock, collect(e) AS envelopes
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
            _acl: parseStoredAclBlock(record.get("aclBlock")),
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
    RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, m.aclBlock AS aclBlock, collect(e) AS envelopes
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
                _acl: parseStoredAclBlock(record.get("aclBlock")),
                envelopes,
                parsed,
            };
        });
    }

    /**
     * Finds all meta-envelopes by ontology across every eName (no tenant isolation).
     * Temporary helper — use with care; intended for the token-gated cross-eVault read endpoint.
     */
    async findMetaEnvelopesByOntologyAcrossAllENames<
        T extends Record<string, any> = Record<string, any>,
    >(
        ontology: string,
    ): Promise<(MetaEnvelopeResult<T> & { eName: string })[]> {
        const result = await this.runQueryInternal(
            `
    MATCH (m:MetaEnvelope { ontology: $ontology })-[:LINKS_TO]->(e:Envelope)
    RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, m.aclBlock AS aclBlock, m.eName AS eName, collect(e) AS envelopes
    `,
            { ontology },
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
                _acl: parseStoredAclBlock(record.get("aclBlock")),
                eName: record.get("eName"),
                envelopes,
                parsed,
            };
        });
    }

    /**
     * Deletes a meta-envelope by pruning it: nothing is destroyed. The record
     * and its envelopes are relabelled PrunedMetaEnvelope / PrunedEnvelope, so
     * every live read stops seeing them, and a delete version is appended to
     * the record's history, which stays readable.
     * @param id - The ID of the meta-envelope to delete
     * @param eName - The eName identifier for multi-tenant isolation
     */
    async deleteMetaEnvelope(
        id: string,
        eName: string,
        awareness?: AwarenessWriteContext,
    ): Promise<void> {
        if (!eName) {
            throw new Error("eName is required for deleting meta-envelopes");
        }

        const origin = writeOrigin(awareness);
        const params: Record<string, unknown> = {
            id,
            eName,
            prunedAt: Date.now(),
        };
        const outbox = awareness && !awareness.skipAwareness;
        if (outbox) {
            Object.assign(
                params,
                awarenessOutboxParams(id, "", eName, null, "delete", awareness),
            );
        }

        const session = this.driver.session();
        try {
            await session.executeWrite(async (tx) => {
                const live = await this.prepareVersionedWrite(tx, id, eName);
                if (!live) return;

                await tx.run(
                    `
      MATCH (m:MetaEnvelope { id: $id, eName: $eName })
      OPTIONAL MATCH (m)-[:LINKS_TO]->(e:Envelope)
      WITH m, collect(e) AS envelopes
      ${
          outbox
              ? `MERGE (s:AwarenessStream { packetId: $awarenessPacketId })
                 SET s.version = coalesce(s.version, 0) + 1
                 CREATE (a:AwarenessOutbox {
                    eventId: $awarenessEventId,
                    packetId: $awarenessPacketId,
                    schemaId: m.ontology,
                    w3id: $awarenessW3id,
                    evaultPublicKey: $awarenessEvaultPublicKey,
                    dataJson: $awarenessDataJson,
                    operation: $awarenessOperation,
                    requestingPlatform: $awarenessRequestingPlatform,
                    occurredAt: $awarenessOccurredAt,
                    streamVersion: s.version,
                    status: 'pending', attempts: 0,
                    nextAttemptAt: $awarenessNow, createdAt: $awarenessNow
                 })
                 WITH m, envelopes`
              : ""
      }
      FOREACH (node IN envelopes |
          REMOVE node:Envelope
          SET node:PrunedEnvelope, node.prunedAt = $prunedAt)
      REMOVE m:MetaEnvelope
      SET m:PrunedMetaEnvelope, m.prunedAt = $prunedAt
      `,
                    params,
                );

                await this.appendVersion(
                    tx,
                    id,
                    eName,
                    "delete",
                    { ...live, payload: null },
                    origin,
                );
            });
        } finally {
            await session.close();
        }
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
        awareness?: AwarenessWriteContext,
    ): Promise<void> {
        if (!eName) {
            throw new Error("eName is required for updating envelope values");
        }

        const { value: storedValue, type: valueType } =
            serializeValue(newValue);

        const session = this.driver.session();
        try {
            await session.executeWrite(async (tx) => {
                const owner = await tx.run(
                    `
                    MATCH (m:MetaEnvelope { eName: $eName })-[:LINKS_TO]->(:Envelope { id: $envelopeId })
                    RETURN m.id AS id LIMIT 1
                    `,
                    { envelopeId, eName },
                );
                const metaEnvelopeId: string | undefined =
                    owner.records[0]?.get("id");
                if (!metaEnvelopeId) return;
                const origin = writeOrigin(awareness);
                await this.prepareVersionedWrite(tx, metaEnvelopeId, eName);

                const result = await tx.run(
                    `
                    MATCH (m:MetaEnvelope { id: $metaEnvelopeId, eName: $eName })-[:LINKS_TO]->(e:Envelope { id: $envelopeId })
                    SET e.value = $newValue, e.valueType = $valueType
                    WITH m
                    MATCH (m)-[:LINKS_TO]->(allEnvelope:Envelope)
                    RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, m.aclBlock AS aclBlock, collect(allEnvelope) AS envelopes
                    `,
                    {
                        metaEnvelopeId,
                        envelopeId,
                        newValue: storedValue,
                        valueType,
                        eName,
                    },
                );
                const record = result.records[0];
                if (!record) return;
                const payload = payloadFromEnvelopeNodes(
                    record.get("envelopes"),
                );
                await this.appendVersion(
                    tx,
                    metaEnvelopeId,
                    eName,
                    "update",
                    {
                        ontology: record.get("ontology"),
                        acl: record.get("acl") ?? [],
                        aclBlock: record.get("aclBlock") ?? null,
                        payload,
                    },
                    origin,
                );
                if (!awareness || awareness.skipAwareness) return;
                await tx.run(
                    `MATCH (m:MetaEnvelope { id: $awarenessPacketId, eName: $awarenessW3id })
                     ${CREATE_AWARENESS_OUTBOX}`,
                    awarenessOutboxParams(
                        record.get("id"),
                        record.get("ontology"),
                        eName,
                        payload,
                        "update",
                        awareness,
                    ),
                );
            });
        } finally {
            await session.close();
        }
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
        awareness?: AwarenessWriteContext,
    ): Promise<StoreMetaEnvelopeResult<T>> {
        return timed("db.updateMetaEnvelopeById", async () => {
            if (!eName) {
                throw new Error(
                    "eName is required for updating meta-envelopes",
                );
            }

            // The whole read-modify-write cycle runs inside a single Neo4j write
            // transaction. Locking the record's history first, and then the
            // opening MERGE+SET on the MetaEnvelope node, makes concurrent
            // updates to the same id serialize here — without this, request
            // B's "delete stale envelopes" step could clobber fields that
            // request A just wrote, and versions could be recorded out of order.
            const session = this.driver.session();
            const origin = writeOrigin(awareness);
            try {
                return await session.executeWrite(async (tx) => {
                    const previous = await this.prepareVersionedWrite(tx, id, eName);

                    const findResult = await tx.run(
                        `
                    MERGE (m:MetaEnvelope { id: $id, eName: $eName })
                    ON CREATE SET m.ontology = $ontology, m.acl = $acl, m.aclBlock = $aclBlock
                    ON MATCH SET m.ontology = $ontology, m.acl = $acl, m.aclBlock = coalesce($aclBlock, m.aclBlock)
                    WITH m
                    OPTIONAL MATCH (m)-[:LINKS_TO]->(e:Envelope)
                    RETURN m.aclBlock AS aclBlock, collect(e) AS envelopes
                    `,
                        {
                            id,
                            eName,
                            ontology: meta.ontology,
                            acl,
                            aclBlock: serializeAclBlock(meta._acl),
                        },
                    );

                    const envelopeNodes: any[] = (
                        findResult.records[0]?.get("envelopes") ?? []
                    ).filter((n: any) => n !== null && n !== undefined);

                    let workingEnvelopes: Envelope<T[keyof T]>[] =
                        envelopeNodes.map((node: any) => ({
                            id: node.properties.id,
                            ontology: node.properties.ontology,
                            value: deserializeValue(
                                node.properties.value,
                                node.properties.valueType,
                            ) as T[keyof T],
                            valueType: node.properties.valueType,
                        }));

                    // Deduplicate envelopes — if multiple Envelope nodes share the
                    // same ontology, keep the first and prune the rest.
                    const seen = new Map<string, string>();
                    const dupsToPrune: string[] = [];
                    for (const env of workingEnvelopes) {
                        if (seen.has(env.ontology)) {
                            dupsToPrune.push(env.id);
                        } else {
                            seen.set(env.ontology, env.id);
                        }
                    }
                    if (dupsToPrune.length > 0) {
                        console.warn(
                            `[eVault] Pruning ${dupsToPrune.length} duplicate envelope(s) for MetaEnvelope ${id}`,
                        );
                        await tx.run(
                            `
                            MATCH (:MetaEnvelope { id: $id, eName: $eName })-[:LINKS_TO]->(e:Envelope)
                            WHERE e.id IN $ids
                            REMOVE e:Envelope
                            SET e:PrunedEnvelope, e.prunedAt = $now
                            `,
                            { id, eName, ids: dupsToPrune, now: Date.now() },
                        );
                        workingEnvelopes = workingEnvelopes.filter(
                            (e) => !dupsToPrune.includes(e.id),
                        );
                    }

                    const createdEnvelopes: Envelope<T[keyof T]>[] = [];

                    for (const [key, value] of Object.entries(meta.payload)) {
                        const { value: storedValue, type: valueType } =
                            serializeValue(value);
                        const existingEnvelope = workingEnvelopes.find(
                            (e) => e.ontology === key,
                        );

                        if (existingEnvelope) {
                            await tx.run(
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
                            const envW3id = await new W3IDBuilder().build();
                            const envelopeId = envW3id.id;
                            await tx.run(
                                `
                            MATCH (m:MetaEnvelope { id: $metaId, eName: $eName })
                            MERGE (m)-[:LINKS_TO]->(e:Envelope { ontology: $ontology })
                            ON CREATE SET e.id = $envelopeId, e.value = $newValue, e.valueType = $valueType
                            ON MATCH SET e.value = $newValue, e.valueType = $valueType
                            `,
                                {
                                    metaId: id,
                                    eName,
                                    envelopeId,
                                    ontology: key,
                                    newValue: storedValue,
                                    valueType,
                                },
                            );
                            createdEnvelopes.push({
                                id: envelopeId,
                                ontology: key,
                                value: value as T[keyof T],
                                valueType,
                            });
                        }
                    }

                    // PATCH semantics: fields absent from the new payload are
                    // left alone. Callers (notably web3-adapter) project partial
                    // platform updates through toGlobal — if the platform only
                    // touched one column, only one ontology reaches us, and
                    // deleting "stale" envelopes here would clobber every other
                    // field on the meta-envelope (e.g. wiping participantIds when
                    // a read-receipt update arrives).

                    // Build the full post-write state by merging the pre-write
                    // envelope set with everything we just wrote. Used by
                    // resolvers to fan out webhooks containing the complete
                    // merged state — receivers overwrite their local row with
                    // whatever the webhook carries, so a partial diff would
                    // make them lose every untouched field.
                    const mergedPayload: Record<string, any> = {};
                    for (const env of workingEnvelopes) {
                        mergedPayload[env.ontology] = env.value;
                    }
                    for (const env of createdEnvelopes) {
                        mergedPayload[env.ontology] = env.value;
                    }

                    await this.appendVersion(
                        tx,
                        id,
                        eName,
                        previous ? "update" : "create",
                        {
                            ontology: meta.ontology,
                            acl,
                            aclBlock:
                                findResult.records[0]?.get("aclBlock") ?? null,
                            payload: mergedPayload,
                        },
                        origin,
                    );

                    if (awareness && !awareness.skipAwareness) {
                        await tx.run(
                            `MATCH (m:MetaEnvelope { id: $awarenessPacketId, eName: $awarenessW3id })
                         ${CREATE_AWARENESS_OUTBOX}`,
                            awarenessOutboxParams(
                                id,
                                meta.ontology,
                                eName,
                                mergedPayload,
                                "update",
                                awareness,
                            ),
                        );
                    }

                    return {
                        metaEnvelope: {
                            id,
                            ontology: meta.ontology,
                            acl,
                            _acl: meta._acl,
                        },
                        envelopes: createdEnvelopes,
                        mergedPayload,
                    };
                });
            } catch (error) {
                console.error("Error in updateMetaEnvelopeById:", error);
                throw error;
            } finally {
                await session.close();
            }
        });
    }

    /**
     * Rolls a MetaEnvelope back to an earlier version. Nothing is rewritten:
     * the earlier state is written as a new version on top of the history, so
     * the version number keeps increasing and the rollback can itself be
     * rolled back.
     *
     * Unlike an update this replaces the payload exactly — fields the earlier
     * version did not have are pruned. The record keeps the access policy it
     * has now, so restoring old data never restores old access. Rolling back a
     * pruned record brings it back.
     * @param id - The ID of the meta-envelope
     * @param eName - The eName identifier for multi-tenant isolation
     * @param toVersion - The version whose state to restore
     */
    async rollbackMetaEnvelope(
        id: string,
        eName: string,
        toVersion: number,
        awareness?: AwarenessWriteContext,
    ): Promise<MetaEnvelopeRollbackResult> {
        if (!eName) {
            throw new Error("eName is required for rolling back meta-envelopes");
        }
        if (!Number.isInteger(toVersion) || toVersion < 1) {
            throw new MetaEnvelopeRollbackError(
                "INVALID_VERSION",
                "version must be a positive integer",
            );
        }

        const origin = writeOrigin(awareness);
        const session = this.driver.session();
        try {
            return await session.executeWrite(async (tx) => {
                const live = await this.prepareVersionedWrite(tx, id, eName);

                const targetResult = await tx.run(
                    `
                    MATCH (v:MetaEnvelopeVersion { metaEnvelopeId: $id, eName: $eName, version: $version })
                    RETURN v.operation AS operation, v.ontology AS ontology,
                           v.payloadJson AS payloadJson, v.fieldsJson AS fieldsJson
                    `,
                    { id, eName, version: neo4j.int(toVersion) },
                );
                const target = targetResult.records[0];
                if (!target) {
                    throw new MetaEnvelopeRollbackError(
                        "VERSION_NOT_FOUND",
                        `MetaEnvelope ${id} has no version ${toVersion}`,
                    );
                }
                if (target.get("operation") === "delete") {
                    throw new MetaEnvelopeRollbackError(
                        "VERSION_IS_DELETE",
                        `Version ${toVersion} records a removal, not a state to restore`,
                    );
                }

                const fields = restorableFields(
                    target.get("fieldsJson"),
                    target.get("payloadJson"),
                );
                const ontology: string = target.get("ontology");

                // Keep the access policy in force now (or, for a pruned record,
                // the last one it carried) rather than the target version's.
                let access = live
                    ? { acl: live.acl, aclBlock: live.aclBlock }
                    : null;
                if (!access) {
                    const lastAcl = await tx.run(
                        `
                        MATCH (v:MetaEnvelopeVersion { metaEnvelopeId: $id, eName: $eName })
                        RETURN v.acl AS acl, v.aclBlock AS aclBlock
                        ORDER BY v.version DESC LIMIT 1
                        `,
                        { id, eName },
                    );
                    access = {
                        acl: lastAcl.records[0]?.get("acl") ?? [],
                        aclBlock: lastAcl.records[0]?.get("aclBlock") ?? null,
                    };
                }

                const current = await tx.run(
                    `
                    MERGE (m:MetaEnvelope { id: $id, eName: $eName })
                    ON CREATE SET m.ontology = $ontology, m.acl = $acl, m.aclBlock = $aclBlock
                    ON MATCH SET m.ontology = $ontology
                    WITH m
                    OPTIONAL MATCH (m)-[:LINKS_TO]->(e:Envelope)
                    RETURN collect(e) AS envelopes
                    `,
                    {
                        id,
                        eName,
                        ontology,
                        acl: access.acl,
                        aclBlock: access.aclBlock,
                    },
                );

                // Reuse one envelope per restored field so envelope ids stay
                // stable; everything else on the record is pruned.
                const reusable = new Map<string, string>();
                const toPrune: string[] = [];
                for (const node of current.records[0]?.get("envelopes") ?? []) {
                    if (!node) continue;
                    const key = node.properties.ontology;
                    if (key in fields && !reusable.has(key)) {
                        reusable.set(key, node.properties.id);
                    } else {
                        toPrune.push(node.properties.id);
                    }
                }

                if (toPrune.length > 0) {
                    await tx.run(
                        `
                        MATCH (:MetaEnvelope { id: $id, eName: $eName })-[:LINKS_TO]->(e:Envelope)
                        WHERE e.id IN $ids
                        REMOVE e:Envelope
                        SET e:PrunedEnvelope, e.prunedAt = $now
                        `,
                        { id, eName, ids: toPrune, now: Date.now() },
                    );
                }

                for (const [key, field] of Object.entries(fields)) {
                    const envelopeId = reusable.get(key);
                    if (envelopeId) {
                        await tx.run(
                            `
                            MATCH (:MetaEnvelope { id: $id, eName: $eName })-[:LINKS_TO]->(e:Envelope { id: $envelopeId })
                            SET e.value = $value, e.valueType = $valueType
                            `,
                            {
                                id,
                                eName,
                                envelopeId,
                                value: field.value,
                                valueType: field.valueType,
                            },
                        );
                    } else {
                        await tx.run(
                            `
                            MATCH (m:MetaEnvelope { id: $id, eName: $eName })
                            CREATE (m)-[:LINKS_TO]->(:Envelope {
                                id: $envelopeId, ontology: $key, value: $value, valueType: $valueType
                            })
                            `,
                            {
                                id,
                                eName,
                                envelopeId: (await new W3IDBuilder().build()).id,
                                key,
                                value: field.value,
                                valueType: field.valueType,
                            },
                        );
                    }
                }

                const restored = await this.readLiveSnapshot(tx, id, eName);
                if (!restored) {
                    throw new Error(`MetaEnvelope ${id} vanished during rollback`);
                }
                const operation = live ? "update" : "create";
                await this.appendVersion(
                    tx,
                    id,
                    eName,
                    operation,
                    restored,
                    origin,
                    toVersion,
                );

                if (awareness && !awareness.skipAwareness) {
                    await tx.run(
                        `MATCH (m:MetaEnvelope { id: $awarenessPacketId, eName: $awarenessW3id })
                         ${CREATE_AWARENESS_OUTBOX}`,
                        awarenessOutboxParams(
                            id,
                            ontology,
                            eName,
                            restored.payload,
                            operation,
                            awareness,
                        ),
                    );
                }

                const versionResult = await tx.run(
                    `MATCH (h:MetaEnvelopeHistory { metaEnvelopeId: $id, eName: $eName })
                     RETURN h.latestVersion AS latestVersion`,
                    { id, eName },
                );
                const envelopesResult = await tx.run(
                    `MATCH (:MetaEnvelope { id: $id, eName: $eName })-[:LINKS_TO]->(e:Envelope)
                     RETURN collect(e) AS envelopes`,
                    { id, eName },
                );
                const envelopes: Envelope[] = (
                    envelopesResult.records[0]?.get("envelopes") ?? []
                ).map((node: any) => ({
                    id: node.properties.id,
                    ontology: node.properties.ontology,
                    value: deserializeValue(
                        node.properties.value,
                        node.properties.valueType,
                    ),
                    valueType: node.properties.valueType,
                }));

                return {
                    metaEnvelope: {
                        id,
                        ontology,
                        acl: restored.acl,
                        _acl: parseStoredAclBlock(restored.aclBlock),
                        envelopes,
                        parsed: restored.payload ?? {},
                    },
                    operation,
                    version:
                        toNumberOrNull(
                            versionResult.records[0]?.get("latestVersion"),
                        ) ?? 0,
                    restoredFromVersion: toVersion,
                };
            });
        } finally {
            await session.close();
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
    RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, m.aclBlock AS aclBlock, collect(e) AS envelopes
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
                _acl: parseStoredAclBlock(record.get("aclBlock")),
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
                SET m.ontology = $ontology, m.acl = $acl, m.aclBlock = $aclBlock
                `,
                {
                    metaId: metaEnvelope.id,
                    ontology: metaEnvelope.ontology,
                    acl: metaEnvelope.acl,
                    aclBlock: serializeAclBlock(metaEnvelope._acl),
                    eName: eName,
                },
            );

            // Copy all envelopes for this meta-envelope
            for (const envelope of metaEnvelope.envelopes) {
                const { value: storedValue, type: valueType } = serializeValue(
                    envelope.value,
                );

                // Ensure value and valueType are explicitly null if undefined (Neo4j requires explicit null)
                const valueParam =
                    storedValue !== undefined ? storedValue : null;
                const valueTypeParam =
                    valueType !== undefined ? valueType : null;

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

        // Copy the version history so it survives the move with its records
        const historyResult = await this.runQueryInternal(
            `MATCH (h:MetaEnvelopeHistory { eName: $eName }) RETURN properties(h) AS props`,
            { eName },
        );
        const histories = historyResult.records.map((r) => r.get("props"));
        if (histories.length > 0) {
            await targetDbService.runQuery(
                `
                UNWIND $rows AS row
                MERGE (h:MetaEnvelopeHistory { metaEnvelopeId: row.metaEnvelopeId, eName: row.eName })
                SET h += row
                `,
                { rows: histories },
            );
        }
        const versionResult = await this.runQueryInternal(
            `MATCH (v:MetaEnvelopeVersion { eName: $eName }) RETURN properties(v) AS props`,
            { eName },
        );
        const versions = versionResult.records.map((r) => r.get("props"));
        if (versions.length > 0) {
            await targetDbService.runQuery(
                `
                UNWIND $rows AS row
                MERGE (v:MetaEnvelopeVersion { metaEnvelopeId: row.metaEnvelopeId, eName: row.eName, version: row.version })
                SET v += row
                `,
                { rows: versions },
            );
            console.log(
                `[MIGRATION] Copied ${versions.length} MetaEnvelope versions for eName: ${eName}`,
            );
        }

        // Copy User node with public keys if it exists
        try {
            const userResult = await this.runQueryInternal(
                `MATCH (u:User { eName: $eName }) RETURN u.publicKeys AS publicKeys`,
                { eName },
            );

            if (userResult.records.length > 0) {
                const publicKeys = userResult.records[0].get("publicKeys");
                if (
                    publicKeys &&
                    Array.isArray(publicKeys) &&
                    publicKeys.length > 0
                ) {
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
                author: $author,
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
                author: params.author ?? null,
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
            throw new Error(
                "eName is required for getting envelope operation logs",
            );
        }
        const limit = Math.min(Math.max(1, options.limit || 20), 100);
        const cursor = options.cursor ?? null;

        // Fetch limit+1 to know if there's a next page. Cursor format: "timestamp|id" (| avoids colons in ISO timestamp).
        const [cursorTs = "", cursorId = ""] = cursor ? cursor.split("|") : [];
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
                   l.platform AS platform, l.author AS author, l.timestamp AS timestamp, l.ontology AS ontology
            `
                : `
            MATCH (l:EnvelopeOperationLog { eName: $eName })
            WITH l
            ORDER BY l.timestamp DESC, l.id ASC
            LIMIT $limitPlusOne
            RETURN l.id AS id, l.eName AS eName, l.metaEnvelopeId AS metaEnvelopeId,
                   l.envelopeHash AS envelopeHash, l.operation AS operation,
                   l.platform AS platform, l.author AS author, l.timestamp AS timestamp, l.ontology AS ontology
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
            author: r.get("author") ?? null,
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
                author: r.author,
                timestamp: r.timestamp,
                ...(r.ontology != null && { ontology: r.ontology }),
            }),
        );

        const last = logs[logs.length - 1];
        const nextCursor =
            hasMore && last ? `${last.timestamp}|${last.id}` : null;

        return { logs, nextCursor, hasMore };
    }

    /**
     * Returns the version history of a MetaEnvelope, newest first. History is
     * kept for pruned records too, so this answers for ids that no live read
     * returns any more.
     * @param id - The ID of the meta-envelope
     * @param eName - The eName identifier for multi-tenant isolation
     */
    async getMetaEnvelopeVersions<
        T extends Record<string, any> = Record<string, any>,
    >(
        id: string,
        eName: string,
        options: { first?: number; after?: string } = {},
    ): Promise<MetaEnvelopeVersionConnection<T>> {
        if (!eName) {
            throw new Error(
                "eName is required for reading meta-envelope history",
            );
        }

        const limit = Math.min(Math.max(1, options.first ?? 20), 100);
        let afterVersion: number | null = null;
        if (options.after) {
            afterVersion = Number(
                Buffer.from(options.after, "base64").toString("utf-8"),
            );
            if (!Number.isInteger(afterVersion)) {
                throw new Error("Invalid cursor");
            }
        }

        const session = this.driver.session();
        let countResult;
        let result;
        try {
            countResult = await session.run(
                `
                MATCH (v:MetaEnvelopeVersion { metaEnvelopeId: $id, eName: $eName })
                RETURN count(v) AS total
                `,
                { id, eName },
            );
            result = await session.run(
                `
                MATCH (v:MetaEnvelopeVersion { metaEnvelopeId: $id, eName: $eName })
                WHERE $afterVersion IS NULL OR v.version < $afterVersion
                WITH v
                ORDER BY v.version DESC
                LIMIT $limitPlusOne
                RETURN v.version AS version, v.operation AS operation, v.ontology AS ontology,
                       v.payloadJson AS payloadJson, v.requestingPlatform AS requestingPlatform,
                       v.author AS author, v.restoredFromVersion AS restoredFromVersion,
                       v.createdAt AS createdAt
                `,
                {
                    id,
                    eName,
                    afterVersion:
                        afterVersion === null ? null : neo4j.int(afterVersion),
                    limitPlusOne: neo4j.int(limit + 1),
                },
            );
        } finally {
            await session.close();
        }

        const total = countResult.records[0]?.get("total");
        const totalCount =
            typeof total?.toNumber === "function"
                ? total.toNumber()
                : Number(total ?? 0);

        const hasMore = result.records.length > limit;
        const edges = result.records.slice(0, limit).map((record) => {
            const rawVersion = record.get("version");
            const version =
                typeof rawVersion?.toNumber === "function"
                    ? rawVersion.toNumber()
                    : Number(rawVersion);
            const payloadJson = record.get("payloadJson");
            const node: MetaEnvelopeVersion<T> = {
                metaEnvelopeId: id,
                version,
                operation: record.get("operation"),
                ontology: record.get("ontology"),
                parsed: payloadJson == null ? null : JSON.parse(payloadJson),
                requestingPlatform: record.get("requestingPlatform") ?? null,
                author: record.get("author") ?? null,
                restoredFromVersion: toNumberOrNull(record.get("restoredFromVersion")),
                createdAt: record.get("createdAt"),
            };
            return {
                cursor: Buffer.from(String(version)).toString("base64"),
                node,
            };
        });

        return {
            edges,
            pageInfo: {
                hasNextPage: hasMore,
                hasPreviousPage: afterVersion !== null,
                startCursor: edges[0]?.cursor ?? null,
                endCursor: edges[edges.length - 1]?.cursor ?? null,
            },
            totalCount,
        };
    }

    /**
     * Returns the access policy a MetaEnvelope carried at its latest recorded
     * version, so its history stays guarded by the same rules once pruned.
     */
    async getLatestMetaEnvelopeVersionAcl(
        id: string,
        eName: string,
    ): Promise<Pick<MetaEnvelopeResult, "acl" | "_acl"> | null> {
        if (!eName) {
            throw new Error(
                "eName is required for reading meta-envelope history",
            );
        }
        const result = await this.runQueryInternal(
            `
            MATCH (v:MetaEnvelopeVersion { metaEnvelopeId: $id, eName: $eName })
            RETURN v.acl AS acl, v.aclBlock AS aclBlock
            ORDER BY v.version DESC
            LIMIT 1
            `,
            { id, eName },
        );
        const record = result.records[0];
        if (!record) return null;
        return {
            acl: record.get("acl") ?? [],
            _acl: parseStoredAclBlock(record.get("aclBlock")),
        };
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
        // Reject mixed-direction cursor usage
        if (first !== undefined && before !== undefined) {
            throw new Error(
                "Cannot use 'first' with 'before' - use 'first' with 'after' for forward pagination",
            );
        }
        if (last !== undefined && after !== undefined) {
            throw new Error(
                "Cannot use 'last' with 'after' - use 'last' with 'before' for backward pagination",
            );
        }

        // Default limit
        const limit = Math.min(Math.max(1, first ?? last ?? 20), 100);
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
                        matchExpr =
                            "toLower(toString(e.value)) = toLower($searchTerm)";
                        break;
                    case "STARTS_WITH":
                        matchExpr =
                            "toLower(toString(e.value)) STARTS WITH toLower($searchTerm)";
                        break;
                    default:
                        // CONTAINS is the default mode
                        matchExpr =
                            "toLower(toString(e.value)) CONTAINS toLower($searchTerm)";
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

        // Run count + main query in a single session to reduce pool pressure
        const countQuery = `
            MATCH (m:MetaEnvelope)
            WHERE ${conditions.join(" AND ")}
            ${searchCondition}
            RETURN count(m) AS total
        `;
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
            RETURN m.id AS id, m.ontology AS ontology, m.acl AS acl, m.aclBlock AS aclBlock, collect(e) AS envelopes
        `;
        params.limitPlusOne = neo4j.int(limit + 1);

        const session = this.driver.session();
        let countResult;
        let result;
        try {
            countResult = await session.run(countQuery, params);
            result = await session.run(mainQuery, params);
        } finally {
            await session.close();
        }

        const totalCount =
            countResult.records[0]?.get("total")?.toNumber?.() ??
            countResult.records[0]?.get("total") ??
            0;

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
                _acl: parseStoredAclBlock(record.get("aclBlock")),
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
            hasNextPage: isBackward ? before !== undefined : hasExtraRecord,
            hasPreviousPage: isBackward ? hasExtraRecord : after !== undefined,
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
