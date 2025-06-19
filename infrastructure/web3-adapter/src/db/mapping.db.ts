import sqlite3 from "sqlite3";
import { join } from "path";
import { promisify } from "util";

export class MappingDatabase {
    private db: sqlite3.Database;
    private runAsync: (sql: string, params?: any) => Promise<void>;
    private getAsync: (sql: string, params?: any) => Promise<any>;
    private allAsync: (sql: string, params?: any) => Promise<any[]>;

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
                table_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (global_id, table_name)
            )
        `);

        await this.runAsync(`
            CREATE INDEX IF NOT EXISTS idx_local_id ON id_mappings(local_id)
        `);

        await this.runAsync(`
            CREATE INDEX IF NOT EXISTS idx_table_name ON id_mappings(table_name)
        `);
    }

    /**
     * Store a mapping between local and global IDs
     */
    public async storeMapping(params: {
        localId: string;
        globalId: string;
        tableName: string;
    }): Promise<void> {
        // Validate inputs
        if (!params.localId || !params.globalId || !params.tableName) {
            throw new Error(
                "Invalid mapping parameters: all fields are required",
            );
        }

        // Check if mapping already exists
        const existingMapping = await this.getGlobalId({
            localId: params.localId,
            tableName: params.tableName,
        });

        if (existingMapping) {
            return;
        }

        try {
            await this.runAsync(
                `INSERT INTO id_mappings (local_id, global_id, table_name)
                VALUES (?, ?, ?)`,
                [params.localId, params.globalId, params.tableName],
            );

            const storedMapping = await this.getGlobalId({
                localId: params.localId,
                tableName: params.tableName,
            });

            if (storedMapping !== params.globalId) {
                throw new Error("Failed to store mapping");
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get the global ID for a local ID
     */
    public async getGlobalId(params: {
        localId: string;
        tableName: string;
    }): Promise<string | null> {
        if (!params.localId || !params.tableName) {
            return null;
        }

        try {
            const result = await this.getAsync(
                `SELECT global_id
                FROM id_mappings
                WHERE local_id = ? AND table_name = ?`,
                [params.localId, params.tableName],
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
    public async getLocalId(params: {
        globalId: string;
        tableName: string;
    }): Promise<string | null> {
        if (!params.globalId || !params.tableName) {
            return null;
        }

        try {
            const result = await this.getAsync(
                `SELECT local_id
                FROM id_mappings
                WHERE global_id = ? AND table_name = ?`,
                [params.globalId, params.tableName],
            );
            return result?.local_id ?? null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Delete a mapping
     */
    public async deleteMapping(params: {
        localId: string;
        tableName: string;
    }): Promise<void> {
        if (!params.localId || !params.tableName) {
            return;
        }

        try {
            await this.runAsync(
                `DELETE FROM id_mappings
                WHERE local_id = ? AND table_name = ?`,
                [params.localId, params.tableName],
            );
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get all mappings for a table
     */
    public async getTableMappings(tableName: string): Promise<
        Array<{
            localId: string;
            globalId: string;
        }>
    > {
        if (!tableName) {
            return [];
        }

        try {
            const results = await this.allAsync(
                `SELECT local_id, global_id
                FROM id_mappings
                WHERE table_name = ?`,
                [tableName],
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
