/** An in-memory ClientRepository, for tests. */

import { randomUUID } from "node:crypto";
import type {
    ClientAction,
    ClientChanges,
    ClientRecord,
    ClientRepository,
    NewClient,
} from "./client-store.js";

export class MemoryClientRepository implements ClientRepository {
    private readonly clients = new Map<string, ClientRecord>();
    readonly events: {
        owner: string;
        clientId: string;
        action: ClientAction;
        at: Date;
    }[] = [];

    constructor(private readonly now: () => Date = () => new Date()) {}

    private record(owner: string, clientId: string, action: ClientAction) {
        this.events.push({ owner, clientId, action, at: this.now() });
    }

    private owned(owner: string, clientId: string): ClientRecord | undefined {
        const client = this.clients.get(clientId);
        return client?.ownerEName === owner ? client : undefined;
    }

    async findByClientId(clientId: string): Promise<ClientRecord | null> {
        const client = this.clients.get(clientId);
        return client ? { ...client } : null;
    }

    async findOwned(owner: string, clientId: string): Promise<ClientRecord | null> {
        const client = this.owned(owner, clientId);
        return client ? { ...client } : null;
    }

    async listByOwner(owner: string): Promise<ClientRecord[]> {
        return [...this.clients.values()]
            .filter((client) => client.ownerEName === owner)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((client) => ({ ...client }));
    }

    async create(input: NewClient): Promise<ClientRecord> {
        if (this.clients.has(input.clientId)) {
            throw new Error(`duplicate client_id ${input.clientId}`);
        }
        const now = this.now();
        const client: ClientRecord = {
            ...input,
            id: randomUUID(),
            createdAt: now,
            updatedAt: now,
            secretRotatedAt: now,
            lastUsedAt: null,
        };
        this.clients.set(client.clientId, client);
        this.record(input.ownerEName, input.clientId, "created");
        return { ...client };
    }

    async update(
        owner: string,
        clientId: string,
        changes: ClientChanges,
    ): Promise<ClientRecord | null> {
        const client = this.owned(owner, clientId);
        if (!client) return null;
        Object.assign(client, changes, { updatedAt: this.now() });
        this.record(owner, clientId, "updated");
        return { ...client };
    }

    async rotateSecret(
        owner: string,
        clientId: string,
        secretHash: string,
    ): Promise<ClientRecord | null> {
        const client = this.owned(owner, clientId);
        if (!client) return null;
        const now = this.now();
        Object.assign(client, { secretHash, secretRotatedAt: now, updatedAt: now });
        this.record(owner, clientId, "secret_rotated");
        return { ...client };
    }

    async delete(owner: string, clientId: string): Promise<boolean> {
        if (!this.owned(owner, clientId)) return false;
        this.clients.delete(clientId);
        this.record(owner, clientId, "deleted");
        return true;
    }

    async countCreatedSince(owner: string, since: Date): Promise<number> {
        return this.events.filter(
            (event) =>
                event.owner === owner &&
                event.action === "created" &&
                event.at >= since,
        ).length;
    }

    async touchLastUsed(clientId: string, at: Date): Promise<void> {
        const client = this.clients.get(clientId);
        if (client) client.lastUsedAt = at;
    }
}
