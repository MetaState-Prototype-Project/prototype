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
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (local_id, table_name),
                UNIQUE (global_id, table_name)
            )
        `);

        await this.runAsync(`
            CREATE INDEX IF NOT EXISTS idx_global_id ON id_mappings(global_id)
        `);

        await this.runAsync(`
            CREATE INDEX IF NOT EXISTS idx_table_name ON id_mappings(table_name)
        `);
    }

    /**
     * Store a mapping between local and global IDs (UPSERT)
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

        try {
            // Use UPSERT to handle both insert and update cases
            await this.runAsync(
                `INSERT OR REPLACE INTO id_mappings (local_id, global_id, table_name, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                [params.localId, params.globalId, params.tableName],
            );

            // Verify the mapping was stored correctly
            const storedMapping = await this.getGlobalId({
                localId: params.localId,
                tableName: params.tableName,
            });

            if (storedMapping !== params.globalId) {
                console.error("Mapping verification failed:", {
                    expected: params.globalId,
                    actual: storedMapping,
                    params
                });
                throw new Error("Failed to store mapping - verification failed");
            }

            console.log("Successfully stored mapping:", {
                localId: params.localId,
                globalId: params.globalId,
                tableName: params.tableName
            });
        } catch (error) {
            console.error("Error storing mapping:", error, params);
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
     * Debug method to get all mappings
     */
    public async getAllMappings(): Promise<Array<{
        localId: string;
        globalId: string;
        tableName: string;
        createdAt: string;
        updatedAt: string;
    }>> {
        try {
            const results = await this.allAsync(
                `SELECT local_id, global_id, table_name, created_at, updated_at
                FROM id_mappings
                ORDER BY table_name, local_id`
            );

            return results.map(({ local_id, global_id, table_name, created_at, updated_at }) => ({
                localId: local_id,
                globalId: global_id,
                tableName: table_name,
                createdAt: created_at,
                updatedAt: updated_at,
            }));
        } catch (error) {
            console.error("Error getting all mappings:", error);
            return [];
        }
    }

    /**
     * Debug method to check if a mapping exists
     */
    public async debugMapping(params: {
        localId?: string;
        globalId?: string;
        tableName: string;
    }): Promise<{
        exists: boolean;
        mapping?: any;
        allMappingsForTable: Array<{ localId: string; globalId: string }>;
    }> {
        const { localId, globalId, tableName } = params;
        
        try {
            let mapping = null;
            
            if (localId) {
                const globalIdResult = await this.getGlobalId({ localId, tableName });
                if (globalIdResult) {
                    mapping = { localId, globalId: globalIdResult, tableName };
                }
            }
            
            if (globalId && !mapping) {
                const localIdResult = await this.getLocalId({ globalId, tableName });
                if (localIdResult) {
                    mapping = { localId: localIdResult, globalId, tableName };
                }
            }
            
            const allMappingsForTable = await this.getTableMappings(tableName);
            
            return {
                exists: !!mapping,
                mapping,
                allMappingsForTable,
            };
        } catch (error) {
            console.error("Error debugging mapping:", error);
            return {
                exists: false,
                allMappingsForTable: [],
            };
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
