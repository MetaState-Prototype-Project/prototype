import { Driver } from "neo4j-driver";
import { Neo4jLogStorage } from "./log-storage";
import { LogEvent, StorageSpec } from "w3id";

/**
 * Service for managing log events in Neo4j
 */
export class LogService implements StorageSpec<LogEvent, LogEvent> {
  private logStorage: Neo4jLogStorage;

  constructor(driver: Driver) {
    this.logStorage = new Neo4jLogStorage(driver);
  }

  /**
   * Get the log storage instance
   */
  public getLogStorage(): Neo4jLogStorage {
    return this.logStorage;
  }

  /**
   * Create a new log event
   */
  public async create(body: LogEvent): Promise<LogEvent> {
    return this.logStorage.create(body);
  }

  /**
   * Find a log event by ID
   */
  public async findOne(options: Partial<LogEvent>): Promise<LogEvent> {
    return this.logStorage.findOne(options);
  }

  /**
   * Find log events by options
   */
  public async findMany(options: Partial<LogEvent>): Promise<LogEvent[]> {
    return this.logStorage.findMany(options);
  }
}
