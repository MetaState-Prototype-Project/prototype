import { Driver } from "neo4j-driver";
import { StorageSpec } from "w3id";
import { LogEvent } from "w3id";

/**
 * Neo4j storage adapter for logs implementing the StorageSpec interface
 *
 * Note: We store proofs as a JSON string because Neo4j has limitations on property types:
 * - Neo4j only supports primitive types and arrays of primitives as property values
 * - Complex objects like Maps or nested objects must be serialized
 * - See: https://neo4j.com/docs/cypher-manual/current/values-and-types/
 * - See: https://neo4j.com/docs/cypher-manual/current/syntax/values/#cypher-values
 */
export class Neo4jLogStorage implements StorageSpec<LogEvent, LogEvent> {
  constructor(private driver: Driver) {}

  private mapToLogEvent(properties: any): LogEvent {
    return {
      id: properties.id,
      versionId: properties.versionId,
      versionTime: new Date(properties.versionTime),
      updateKeys: properties.updateKeys,
      nextKeyHashes: properties.nextKeyHashes,
      method: properties.method,
      proofs: properties.proofs ? JSON.parse(properties.proofs) : [],
    };
  }

  public async create(body: LogEvent): Promise<LogEvent> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        CREATE (l:LogEvent {
          id: $id,
          versionId: $versionId,
          versionTime: $versionTime,
          updateKeys: $updateKeys,
          nextKeyHashes: $nextKeyHashes,
          method: $method,
          proofs: $proofs
        })
        RETURN l
        `,
        {
          id: body.id,
          versionId: body.versionId,
          versionTime: body.versionTime.toISOString(),
          updateKeys: body.updateKeys,
          nextKeyHashes: body.nextKeyHashes,
          method: body.method,
          proofs: JSON.stringify(body.proofs || []),
        }
      );
      return this.mapToLogEvent(result.records[0].get("l").properties);
    } finally {
      await session.close();
    }
  }

  public async findOne(options: Partial<LogEvent>): Promise<LogEvent> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (l:LogEvent)
        WHERE l.id = $id
        RETURN l
        `,
        { id: options.id }
      );
      if (result.records.length === 0) {
        throw new Error(`No log event found with id ${options.id}`);
      }
      return this.mapToLogEvent(result.records[0].get("l").properties);
    } finally {
      await session.close();
    }
  }

  public async findMany(options: Partial<LogEvent>): Promise<LogEvent[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (l:LogEvent)
        RETURN l
        `
      );
      const mapped = result.records.map((record) =>
        this.mapToLogEvent(record.get("l").properties)
      );
      return mapped;
    } finally {
      await session.close();
    }
  }
}
