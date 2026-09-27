import type { DataSource, EntityManager } from "typeorm";
import type {
    ClientAction,
    ClientChanges,
    ClientRecord,
    ClientRepository,
    NewClient,
} from "../client-store.js";
import { ClientEntity, ClientEventEntity, type ClientRow } from "./entities.js";

function toRecord(row: ClientRow): ClientRecord {
    return {
        id: row.id,
        clientId: row.client_id,
        secretHash: row.secret_hash,
        name: row.name,
        ownerEName: row.owner_ename,
        redirectUris: row.redirect_uris,
        syntheticEmail: row.synthetic_email,
        logoUrl: row.logo_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        secretRotatedAt: row.secret_rotated_at,
        lastUsedAt: row.last_used_at,
    };
}

export class TypeOrmClientRepository implements ClientRepository {
    constructor(private readonly dataSource: DataSource) {}

    private clients(manager: EntityManager = this.dataSource.manager) {
        return manager.getRepository(ClientEntity);
    }

    private async record(
        manager: EntityManager,
        owner: string,
        clientId: string,
        action: ClientAction,
    ): Promise<void> {
        await manager
            .getRepository(ClientEventEntity)
            .insert({ owner_ename: owner, client_id: clientId, action });
    }

    async findByClientId(clientId: string): Promise<ClientRecord | null> {
        const row = await this.clients().findOneBy({ client_id: clientId });
        return row ? toRecord(row) : null;
    }

    async findOwned(
        owner: string,
        clientId: string,
    ): Promise<ClientRecord | null> {
        const row = await this.clients().findOneBy({
            client_id: clientId,
            owner_ename: owner,
        });
        return row ? toRecord(row) : null;
    }

    async listByOwner(owner: string): Promise<ClientRecord[]> {
        const rows = await this.clients().find({
            where: { owner_ename: owner },
            order: { created_at: "DESC" },
        });
        return rows.map(toRecord);
    }

    async create(client: NewClient): Promise<ClientRecord> {
        return this.dataSource.transaction(async (manager) => {
            const row = await this.clients(manager).save({
                client_id: client.clientId,
                secret_hash: client.secretHash,
                name: client.name,
                owner_ename: client.ownerEName,
                redirect_uris: client.redirectUris,
                synthetic_email: client.syntheticEmail,
                logo_url: client.logoUrl,
            });
            await this.record(manager, client.ownerEName, client.clientId, "created");
            const saved = await this.clients(manager).findOneByOrFail({ id: row.id });
            return toRecord(saved);
        });
    }

    async update(
        owner: string,
        clientId: string,
        changes: ClientChanges,
    ): Promise<ClientRecord | null> {
        return this.dataSource.transaction(async (manager) => {
            const result = await this.clients(manager).update(
                { client_id: clientId, owner_ename: owner },
                {
                    name: changes.name,
                    redirect_uris: changes.redirectUris,
                    synthetic_email: changes.syntheticEmail,
                    logo_url: changes.logoUrl,
                },
            );
            if (!result.affected) return null;
            await this.record(manager, owner, clientId, "updated");
            const row = await this.clients(manager).findOneByOrFail({
                client_id: clientId,
            });
            return toRecord(row);
        });
    }

    async rotateSecret(
        owner: string,
        clientId: string,
        secretHash: string,
    ): Promise<ClientRecord | null> {
        return this.dataSource.transaction(async (manager) => {
            const result = await this.clients(manager).update(
                { client_id: clientId, owner_ename: owner },
                { secret_hash: secretHash, secret_rotated_at: () => "now()" },
            );
            if (!result.affected) return null;
            await this.record(manager, owner, clientId, "secret_rotated");
            const row = await this.clients(manager).findOneByOrFail({
                client_id: clientId,
            });
            return toRecord(row);
        });
    }

    async delete(owner: string, clientId: string): Promise<boolean> {
        return this.dataSource.transaction(async (manager) => {
            const result = await this.clients(manager).delete({
                client_id: clientId,
                owner_ename: owner,
            });
            if (!result.affected) return false;
            await this.record(manager, owner, clientId, "deleted");
            return true;
        });
    }

    async countCreatedSince(owner: string, since: Date): Promise<number> {
        return this.dataSource
            .getRepository(ClientEventEntity)
            .createQueryBuilder("event")
            .where("event.owner_ename = :owner", { owner })
            .andWhere("event.action = 'created'")
            .andWhere("event.at >= :since", { since })
            .getCount();
    }

    async touchLastUsed(clientId: string, at: Date): Promise<void> {
        await this.clients().update({ client_id: clientId }, { last_used_at: at });
    }
}
