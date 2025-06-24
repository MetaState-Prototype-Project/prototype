import { MappingDatabase } from "../db";

export interface IMapping {
    /**
     * Name of the local table, this would be consumed by other schemas to
     * identify relations
     */
    tableName: string;

    /**
     * Schema Identifier for the global schema this table maps to
     */
    schemaId: string;

    /**
     * Path used to determine which eVault owns this entry.
     *
     * This can be a direct field on the table or a nested path via a foreign table.
     *
     * - For direct fields, use the field name (e.g. `"ename"`).
     * - For nested ownership, use a function-like syntax to reference another table
     *   and field (e.g. `"user(createdBy.ename)"` means follow the `createdBy` field,
     *   then resolve `ename` from the `user` table).
     *
     * Use `tableName(fieldPath)` to reference a field from another table.
     *
     * @example "ename" — direct reference to a field on the same table
     * @example "user(createdBy.ename)" — nested reference via the `user` table
     */
    ownerEnamePath: string;

    /**
     * String to String mapping between what path maps to what global ontology
     */
    localToUniversalMap: Record<string, string>;
}

export interface IMappingConversionOptions {
    data: Record<string, unknown>;
    mapping: IMapping;
    mappingStore: MappingDatabase;
}

export interface IMapperResponse {
    ownerEvault: string | null;
    data: Record<string, unknown>;
}
