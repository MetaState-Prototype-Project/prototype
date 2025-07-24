import { join } from "node:path";
import { promisify } from "node:util";
import sqlite3 from "sqlite3";

export class MappingDatabase {
    private db: sqlite3.Database;
    private runAsync: (sql: string, params?: string[]) => Promise<void>;
    private getAsync: (
        sql: string,
        params?: string[],
        // biome-ignore lint/suspicious/noExplicitAny: can't explicitly state that this would return an array of strings
    ) => Promise<Record<string, string | any>>;
    private allAsync: (
        sql: string,
        params?: string[],
        // biome-ignore lint/suspicious/noExplicitAny: can't explicitly state that this would return an array of strings
    ) => Promise<Record<string, string | any>[]>;

    constructor(dbPath: string) {
        // Ensure the directory exists
        const fullPath = join(dbPath, "mappings.db");
        this.db = new sqlite3.Database(fullPath);

        // Promisify database methods
        this.runAsync = promisify(this.db.run.bind(this.db));
        this.getAsync = promisify(this.db.get.bind(this.db));
        this.allAsync = promisify(this.db.all.bind(this.db));

        // Initialize the database with the required tables
        this.initialize();
    }

    private async initialize() {
        await this.runAsync(`
            CREATE TABLE IF NOT EXISTS id_mappings (
                local_id TEXT NOT NULL,
                global_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (global_id)
            )
        `);

        await this.runAsync(`
            CREATE INDEX IF NOT EXISTS idx_local_id ON id_mappings(local_id)
        `);
    }

    /**
     * Store a mapping between local and global IDs
     */
    public async storeMapping(params: {
        localId: string;
        globalId: string;
    }): Promise<void> {
        // Validate inputs
        if (!params.localId || !params.globalId) {
            throw new Error(
                "Invalid mapping parameters: all fields are required",
            );
        }

        console.log("storing mapping g:l", params.globalId, params.localId);

        // Check if mapping already exists
        const existingMapping = await this.getGlobalId(params.localId);

        if (existingMapping) {
            return;
        }

        await this.runAsync(
            `INSERT INTO id_mappings (local_id, global_id)
                VALUES (?, ?)`,
            [params.localId, params.globalId],
        );

        const storedMapping = await this.getGlobalId(params.localId);

        if (storedMapping !== params.globalId) {
            console.log("storedMappingError", storedMapping, params.globalId);
            console.error("Failed to store mapping");
            return;
        }
    }

    /**
     * Get the global ID for a local ID
     */
    public async getGlobalId(localId: string): Promise<string | null> {
        if (!localId) {
            return null;
        }

        try {
            const result = await this.getAsync(
                `SELECT global_id
                FROM id_mappings
                WHERE local_id = ?`,
                [localId],
            );
            return result?.global_id ?? null;
        } catch (error) {
            console.error("Error getting global ID:", error);
            return null;
        }
    }

    /**
     * Get the local ID for a global ID
     */
    public async getLocalId(globalId: string): Promise<string | null> {
        if (!globalId) {
            return null;
        }

        try {
            const result = await this.getAsync(
                `SELECT local_id
                FROM id_mappings
                WHERE global_id = ?`,
                [globalId],
            );
            return result?.local_id ?? null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Delete a mapping
     */
    public async deleteMapping(localId: string): Promise<void> {
        if (!localId) {
            return;
        }

        await this.runAsync(
            `DELETE FROM id_mappings
                WHERE local_id = ?`,
            [localId],
        );
    }

    /**
     * Get all mappings
     */
    public async getAllMappings(): Promise<
        Array<{
            localId: string;
            globalId: string;
        }>
    > {
        try {
            const results = await this.allAsync(
                `SELECT local_id, global_id
                FROM id_mappings`,
            );

            return results.map(({ local_id, global_id }) => ({
                localId: local_id,
                globalId: global_id,
            }));
        } catch (error) {
            return [];
        }
    }

    /**
     * Close the database connection
     */
    public close(): void {
        try {
            this.db.close();
        } catch (error) {
            console.error("Error closing database connection:", error);
        }
    }
}
