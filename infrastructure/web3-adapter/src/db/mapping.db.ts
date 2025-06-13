import Database from "better-sqlite3";
import { join } from "path";

export class MappingDatabase {
    private db: Database.Database;

    constructor(dbPath: string) {
        // Ensure the directory exists
        const fullPath = join(dbPath, "mappings.db");
        this.db = new Database(fullPath);

        // Initialize the database with the required tables
        this.initialize();
    }

    private initialize() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS id_mappings (
                local_id TEXT NOT NULL,
                global_id TEXT NOT NULL,
                table_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (global_id, table_name)
            );

            CREATE INDEX IF NOT EXISTS idx_local_id ON id_mappings(local_id);
            CREATE INDEX IF NOT EXISTS idx_table_name ON id_mappings(table_name);
        `);
    }

    /**
     * Store a mapping between local and global IDs
     */
    public storeMapping(params: {
        localId: string;
        globalId: string;
        tableName: string;
    }): void {
        // Validate inputs
        if (!params.localId || !params.globalId || !params.tableName) {
            console.error("Invalid mapping parameters:", params);
            throw new Error("Invalid mapping parameters: all fields are required");
        }

        // Check if mapping already exists
        const existingMapping = this.getGlobalId({
            localId: params.localId,
            tableName: params.tableName,
        });

        if (existingMapping) {
            console.log(
                `Mapping already exists for local ID ${params.localId} in table ${params.tableName}. Existing global ID: ${existingMapping}`
            );
            return;
        }

        const stmt = this.db.prepare(`
            INSERT INTO id_mappings (local_id, global_id, table_name)
            VALUES (@localId, @globalId, @tableName)
        `);

        try {
            console.log(
                "Storing mapping:",
                JSON.stringify({
                    localId: params.localId,
                    globalId: params.globalId,
                    tableName: params.tableName,
                })
            );
            stmt.run(params);
            
            // Verify the mapping was stored
            const storedMapping = this.getGlobalId({
                localId: params.localId,
                tableName: params.tableName,
            });
            
            if (storedMapping !== params.globalId) {
                console.error(
                    "Failed to store mapping. Expected:",
                    params.globalId,
                    "Got:",
                    storedMapping
                );
                throw new Error("Failed to store mapping");
            }
            
            console.log("Successfully stored mapping");
        } catch (error) {
            console.error("Error storing mapping:", error);
            throw error;
        }
    }

    /**
     * Get the global ID for a local ID
     */
    public getGlobalId(params: {
        localId: string;
        tableName: string;
    }): string | null {
        if (!params.localId || !params.tableName) {
            console.error("Invalid parameters for getGlobalId:", params);
            return null;
        }

        const stmt = this.db.prepare(`
            SELECT global_id
            FROM id_mappings
            WHERE local_id = @localId AND table_name = @tableName
        `);

        try {
            const result = stmt.get(params) as { global_id: string } | undefined;
            console.log(
                "Retrieved global ID for local ID",
                params.localId,
                "in table",
                params.tableName,
                "Result:",
                result?.global_id ?? "null"
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
    public getLocalId(params: {
        globalId: string;
        tableName: string;
    }): string | null {
        if (!params.globalId || !params.tableName) {
            console.error("Invalid parameters for getLocalId:", params);
            return null;
        }

        const stmt = this.db.prepare(`
            SELECT local_id
            FROM id_mappings
            WHERE global_id = @globalId AND table_name = @tableName
        `);

        try {
            const result = stmt.get(params) as { local_id: string } | undefined;
            console.log(
                "Retrieved local ID for global ID",
                params.globalId,
                "in table",
                params.tableName,
                "Result:",
                result?.local_id ?? "null"
            );
            return result?.local_id ?? null;
        } catch (error) {
            console.error("Error getting local ID:", error);
            return null;
        }
    }

    /**
     * Delete a mapping
     */
    public deleteMapping(params: { localId: string; tableName: string }): void {
        if (!params.localId || !params.tableName) {
            console.error("Invalid parameters for deleteMapping:", params);
            return;
        }

        const stmt = this.db.prepare(`
            DELETE FROM id_mappings
            WHERE local_id = @localId AND table_name = @tableName
        `);

        try {
            console.log(
                "Deleting mapping for local ID",
                params.localId,
                "in table",
                params.tableName
            );
            stmt.run(params);
            console.log("Successfully deleted mapping");
        } catch (error) {
            console.error("Error deleting mapping:", error);
            throw error;
        }
    }

    /**
     * Get all mappings for a table
     */
    public getTableMappings(tableName: string): Array<{
        localId: string;
        globalId: string;
    }> {
        if (!tableName) {
            console.error("Invalid table name for getTableMappings:", tableName);
            return [];
        }

        const stmt = this.db.prepare(`
            SELECT local_id, global_id
            FROM id_mappings
            WHERE table_name = @tableName
        `);

        try {
            const results = stmt.all({ tableName }) as Array<{
                local_id: string;
                global_id: string;
            }>;

            console.log(
                "Retrieved",
                results.length,
                "mappings for table",
                tableName
            );
            return results.map(({ local_id, global_id }) => ({
                localId: local_id,
                globalId: global_id,
            }));
        } catch (error) {
            console.error("Error getting table mappings:", error);
            return [];
        }
    }

    /**
     * Close the database connection
     */
    public close(): void {
        try {
            this.db.close();
            console.log("Database connection closed");
        } catch (error) {
            console.error("Error closing database connection:", error);
        }
    }
}
