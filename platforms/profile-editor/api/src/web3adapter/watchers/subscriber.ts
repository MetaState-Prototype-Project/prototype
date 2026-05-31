import path from "node:path";
import {
    type EntitySubscriberInterface,
    EventSubscriber,
    type InsertEvent,
    type UpdateEvent,
} from "typeorm";
import { Web3Adapter } from "web3-adapter";
import { env } from "../../env";

/** Single adapter instance — owns the mappings, the eVault client, the id-map. */
export const adapter = new Web3Adapter({
    schemasPath: path.resolve(__dirname, "../mappings/"),
    dbPath: path.resolve(env.mappingDbPath),
    registryUrl: env.registryUrl,
    platform: env.baseUrl,
});

const SYNCED_TABLES = new Set(["users", "professional_profiles"]);

/**
 * Outbound sync: on any local write to users/professional_profiles, push the
 * row to the owner's eVault via the adapter (toGlobal). `lockedIds` skips rows
 * we just received inbound (echo prevention). A 3s debounce coalesces rapid
 * edits and lets the webhook's storeMapping land first.
 */
@EventSubscriber()
export class PostgresSubscriber implements EntitySubscriberInterface {
    private pending = new Map<string, number>();

    constructor() {
        setInterval(
            () => {
                const now = Date.now();
                for (const [key, ts] of this.pending.entries()) {
                    if (now - ts > 10 * 60 * 1000) this.pending.delete(key);
                }
            },
            5 * 60 * 1000,
        );
    }

    afterInsert(event: InsertEvent<unknown>) {
        this.handle(event.entity, event.metadata.tableName);
    }

    afterUpdate(event: UpdateEvent<unknown>) {
        if (event.entity) this.handle(event.entity, event.metadata.tableName);
    }

    private handle(entity: unknown, tableName: string): void {
        if (!SYNCED_TABLES.has(tableName)) return;
        const id = (entity as { id?: string })?.id;
        if (!id) return;

        const key = `${tableName}:${id}`;
        if (this.pending.has(key)) return;
        this.pending.set(key, Date.now());

        setTimeout(async () => {
            try {
                const globalId =
                    (await adapter.mappingDb.getGlobalId(id)) ?? "";
                if (adapter.lockedIds.includes(globalId)) return;

                // Re-fetch the full row so toGlobal sees every mapped field
                // (a TypeORM update event may carry only changed columns).
                const { AppDataSource } = await import("../../db");
                const { User } = await import("../../entities/User");
                const { ProfessionalProfile } = await import(
                    "../../entities/ProfessionalProfile"
                );
                const repo = AppDataSource.getRepository(
                    tableName === "users" ? User : ProfessionalProfile,
                );
                const row = await repo.findOneBy({ id });
                if (!row) return;

                await adapter.handleChange({
                    data: entityToPlain(row),
                    tableName,
                });
            } catch (err) {
                console.error(
                    `[subscriber] ${tableName} sync failed:`,
                    (err as Error).message,
                );
            } finally {
                this.pending.delete(key);
            }
        }, 3_000);
    }
}

function entityToPlain(entity: unknown): Record<string, unknown> {
    const plain: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entity as object)) {
        if (key.startsWith("_")) continue;
        plain[key] = value instanceof Date ? value.toISOString() : value;
    }
    return plain;
}
