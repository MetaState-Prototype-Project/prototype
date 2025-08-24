export declare class MappingDatabase {
    private db;
    private runAsync;
    private getAsync;
    private allAsync;
    constructor(dbPath: string);
    private initialize;
    /**
     * Store a mapping between local and global IDs
     */
    storeMapping(params: {
        localId: string;
        globalId: string;
    }): Promise<void>;
    /**
     * Get the global ID for a local ID
     */
    getGlobalId(localId: string): Promise<string | null>;
    /**
     * Get the local ID for a global ID
     */
    getLocalId(globalId: string): Promise<string | null>;
    /**
     * Delete a mapping
     */
    deleteMapping(localId: string): Promise<void>;
    /**
     * Get all mappings
     */
    getAllMappings(): Promise<Array<{
        localId: string;
        globalId: string;
    }>>;
    /**
     * Close the database connection
     */
    close(): void;
}
//# sourceMappingURL=mapping.db.d.ts.map