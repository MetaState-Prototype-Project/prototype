import {
    PostgreSqlContainer,
    type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { DataSource } from "typeorm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NewClient } from "../client-store.js";
import { TypeOrmClientRepository } from "./client-repository.js";
import { createDataSource } from "./data-source.js";

let container: StartedPostgreSqlContainer;
let dataSource: DataSource;
let repo: TypeOrmClientRepository;

beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    dataSource = createDataSource({ url: container.getConnectionUri() });
    await dataSource.initialize();
    await dataSource.runMigrations();
    repo = new TypeOrmClientRepository(dataSource);
}, 120_000);

afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await container?.stop();
});

beforeEach(async () => {
    await dataSource.query(`TRUNCATE "oidc_clients", "oidc_client_events"`);
});

const client = (overrides: Partial<NewClient> = {}): NewClient => ({
    clientId: `w3ds_${Math.random().toString(36).slice(2)}`,
    secretHash: "sha256:abc",
    name: "My IdP",
    ownerEName: "@alice",
    redirectUris: ["https://kc.example/cb"],
    syntheticEmail: false,
    ...overrides,
});

describe("TypeOrmClientRepository", () => {
    it("has no pending migrations after migrating", async () => {
        expect(await dataSource.showMigrations()).toBe(false);
    });

    it("creates and finds a client", async () => {
        const created = await repo.create(client({ clientId: "w3ds_a" }));
        expect(created).toMatchObject({
            clientId: "w3ds_a",
            ownerEName: "@alice",
            redirectUris: ["https://kc.example/cb"],
            syntheticEmail: false,
            lastUsedAt: null,
        });
        expect(created.createdAt).toBeInstanceOf(Date);
        expect(await repo.findByClientId("w3ds_a")).toMatchObject({ name: "My IdP" });
        expect(await repo.findByClientId("nope")).toBeNull();
    });

    it("rejects a duplicate client ID", async () => {
        await repo.create(client({ clientId: "w3ds_dup" }));
        await expect(repo.create(client({ clientId: "w3ds_dup" }))).rejects.toThrow();
    });

    it("scopes every owner operation to the owner", async () => {
        await repo.create(client({ clientId: "w3ds_mine" }));
        await repo.create(client({ clientId: "w3ds_theirs", ownerEName: "@bob" }));

        expect((await repo.listByOwner("@alice")).map((c) => c.clientId)).toEqual([
            "w3ds_mine",
        ]);
        expect(await repo.findOwned("@alice", "w3ds_theirs")).toBeNull();
        expect(
            await repo.update("@alice", "w3ds_theirs", {
                name: "hijack",
                redirectUris: ["https://evil.example/cb"],
                syntheticEmail: true,
            }),
        ).toBeNull();
        expect(await repo.rotateSecret("@alice", "w3ds_theirs", "sha256:x")).toBeNull();
        expect(await repo.delete("@alice", "w3ds_theirs")).toBe(false);
        expect(await repo.findByClientId("w3ds_theirs")).toMatchObject({
            name: "My IdP",
            secretHash: "sha256:abc",
        });
    });

    it("updates, rotates and deletes an owned client", async () => {
        const created = await repo.create(client({ clientId: "w3ds_c" }));
        const updated = await repo.update("@alice", "w3ds_c", {
            name: "Renamed",
            redirectUris: ["https://a.example/cb", "https://b.example/cb"],
            syntheticEmail: true,
        });
        expect(updated).toMatchObject({
            name: "Renamed",
            redirectUris: ["https://a.example/cb", "https://b.example/cb"],
            syntheticEmail: true,
        });

        const rotated = await repo.rotateSecret("@alice", "w3ds_c", "sha256:new");
        expect(rotated?.secretHash).toBe("sha256:new");
        expect(rotated!.secretRotatedAt.getTime()).toBeGreaterThanOrEqual(
            created.secretRotatedAt.getTime(),
        );

        expect(await repo.delete("@alice", "w3ds_c")).toBe(true);
        expect(await repo.findByClientId("w3ds_c")).toBeNull();
    });

    it("counts creations, including clients later deleted", async () => {
        const since = new Date(Date.now() - 60_000);
        await repo.create(client({ clientId: "w3ds_1" }));
        await repo.create(client({ clientId: "w3ds_2" }));
        await repo.delete("@alice", "w3ds_1");
        await repo.create(client({ clientId: "w3ds_3", ownerEName: "@bob" }));
        expect(await repo.countCreatedSince("@alice", since)).toBe(2);
        expect(await repo.countCreatedSince("@alice", new Date(Date.now() + 60_000))).toBe(0);
    });

    it("records every change in the audit log", async () => {
        await repo.create(client({ clientId: "w3ds_audit" }));
        await repo.update("@alice", "w3ds_audit", {
            name: "x",
            redirectUris: ["https://x.example/cb"],
            syntheticEmail: false,
        });
        await repo.rotateSecret("@alice", "w3ds_audit", "sha256:y");
        await repo.delete("@alice", "w3ds_audit");
        const rows: { action: string }[] = await dataSource.query(
            `SELECT action FROM oidc_client_events WHERE client_id = 'w3ds_audit' ORDER BY at, action`,
        );
        expect(rows.map((r) => r.action).sort()).toEqual([
            "created",
            "deleted",
            "secret_rotated",
            "updated",
        ]);
    });

    it("records when a client was last used", async () => {
        await repo.create(client({ clientId: "w3ds_used" }));
        const at = new Date("2026-09-28T10:00:00Z");
        await repo.touchLastUsed("w3ds_used", at);
        expect((await repo.findByClientId("w3ds_used"))?.lastUsedAt).toEqual(at);
    });
});
