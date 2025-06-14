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
            throw new Error(
                "Invalid mapping parameters: all fields are required"
            );
        }

        // Check if mapping already exists
        const existingMapping = this.getGlobalId({
            localId: params.localId,
            tableName: params.tableName,
        });

        if (existingMapping) {
            return;
        }

        const stmt = this.db.prepare(`
            INSERT INTO id_mappings (local_id, global_id, table_name)
            VALUES (@localId, @globalId, @tableName)
        `);

        try {
            stmt.run(params);

            // Verify the mapping was stored
            const storedMapping = this.getGlobalId({
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
    public getGlobalId(params: {
        localId: string;
        tableName: string;
    }): string | null {
        if (!params.localId || !params.tableName) {
            return null;
        }

        const stmt = this.db.prepare(`
            SELECT global_id
            FROM id_mappings
            WHERE local_id = @localId AND table_name = @tableName
        `);

        try {
            const result = stmt.get(params) as
                | { global_id: string }
                | undefined;
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
            return null;
        }

        const stmt = this.db.prepare(`
            SELECT local_id
            FROM id_mappings
            WHERE global_id = @globalId AND table_name = @tableName
        `);

        try {
            const result = stmt.get(params) as { local_id: string } | undefined;
            return result?.local_id ?? null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Delete a mapping
     */
    public deleteMapping(params: { localId: string; tableName: string }): void {
        if (!params.localId || !params.tableName) {
            return;
        }

        const stmt = this.db.prepare(`
            DELETE FROM id_mappings
            WHERE local_id = @localId AND table_name = @tableName
        `);

        try {
            stmt.run(params);
        } catch (error) {
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
