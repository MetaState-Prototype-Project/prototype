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
                PRIMARY KEY (local_id, table_name)
            );

            CREATE INDEX IF NOT EXISTS idx_global_id ON id_mappings(global_id);
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
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO id_mappings (local_id, global_id, table_name)
            VALUES (@localId, @globalId, @tableName)
        `);

        stmt.run(params);
    }

    /**
     * Get the global ID for a local ID
     */
    public getGlobalId(params: {
        localId: string;
        tableName: string;
    }): string | null {
        const stmt = this.db.prepare(`
            SELECT global_id
            FROM id_mappings
            WHERE local_id = @localId AND table_name = @tableName
        `);

        const result = stmt.get(params) as { global_id: string } | undefined;
        return result?.global_id ?? null;
    }

    /**
     * Get the local ID for a global ID
     */
    public getLocalId(params: {
        globalId: string;
        tableName: string;
    }): string | null {
        const stmt = this.db.prepare(`
            SELECT local_id
            FROM id_mappings
            WHERE global_id = @globalId AND table_name = @tableName
        `);

        const result = stmt.get(params) as { local_id: string } | undefined;
        return result?.local_id ?? null;
    }

    /**
     * Delete a mapping
     */
    public deleteMapping(params: { localId: string; tableName: string }): void {
        const stmt = this.db.prepare(`
            DELETE FROM id_mappings
            WHERE local_id = @localId AND table_name = @tableName
        `);

        stmt.run(params);
    }

    /**
     * Get all mappings for a table
     */
    public getTableMappings(tableName: string): Array<{
        localId: string;
        globalId: string;
    }> {
        const stmt = this.db.prepare(`
            SELECT local_id, global_id
            FROM id_mappings
            WHERE table_name = @tableName
        `);

        const results = stmt.all({ tableName }) as Array<{
            local_id: string;
            global_id: string;
        }>;

        return results.map(({ local_id, global_id }) => ({
            localId: local_id,
            globalId: global_id,
        }));
    }

    /**
     * Close the database connection
     */
    public close(): void {
        this.db.close();
    }
}

 