"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MappingDatabase = void 0;
const node_path_1 = require("node:path");
const node_util_1 = require("node:util");
const sqlite3_1 = __importDefault(require("sqlite3"));
class MappingDatabase {
    constructor(dbPath) {
        // Ensure the directory exists
        const fullPath = (0, node_path_1.join)(dbPath, "mappings.db");
        this.db = new sqlite3_1.default.Database(fullPath);
        // Promisify database methods
        this.runAsync = (0, node_util_1.promisify)(this.db.run.bind(this.db));
        this.getAsync = (0, node_util_1.promisify)(this.db.get.bind(this.db));
        this.allAsync = (0, node_util_1.promisify)(this.db.all.bind(this.db));
        // Initialize the database with the required tables
        this.initialize();
    }
    async initialize() {
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
    async storeMapping(params) {
        // Validate inputs
        if (!params.localId || !params.globalId) {
            throw new Error("Invalid mapping parameters: all fields are required");
        }
        console.log("storing mapping g:l", params.globalId, params.localId);
        // Check if mapping already exists
        const existingMapping = await this.getGlobalId(params.localId);
        if (existingMapping) {
            return;
        }
        await this.runAsync(`INSERT INTO id_mappings (local_id, global_id)
                VALUES (?, ?)`, [params.localId, params.globalId]);
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
    async getGlobalId(localId) {
        if (!localId) {
            return null;
        }
        try {
            const result = await this.getAsync(`SELECT global_id
                FROM id_mappings
                WHERE local_id = ?`, [localId]);
            return result?.global_id ?? null;
        }
        catch (error) {
            console.error("Error getting global ID:", error);
            return null;
        }
    }
    /**
     * Get the local ID for a global ID
     */
    async getLocalId(globalId) {
        if (!globalId) {
            return null;
        }
        try {
            const result = await this.getAsync(`SELECT local_id
                FROM id_mappings
                WHERE global_id = ?`, [globalId]);
            return result?.local_id ?? null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Delete a mapping
     */
    async deleteMapping(localId) {
        if (!localId) {
            return;
        }
        await this.runAsync(`DELETE FROM id_mappings
                WHERE local_id = ?`, [localId]);
    }
    /**
     * Get all mappings
     */
    async getAllMappings() {
        try {
            const results = await this.allAsync(`SELECT local_id, global_id
                FROM id_mappings`);
            return results.map(({ local_id, global_id }) => ({
                localId: local_id,
                globalId: global_id,
            }));
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Close the database connection
     */
    close() {
        try {
            this.db.close();
        }
        catch (error) {
            console.error("Error closing database connection:", error);
        }
    }
}
exports.MappingDatabase = MappingDatabase;
//# sourceMappingURL=mapping.db.js.map