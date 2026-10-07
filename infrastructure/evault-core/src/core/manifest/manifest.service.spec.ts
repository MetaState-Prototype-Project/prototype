import type { Driver } from "neo4j-driver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    setupTestNeo4j,
    teardownTestNeo4j,
} from "../../test-utils/neo4j-setup";
import { DbService } from "../db/db.service";
import { createUserENameConstraint } from "../db/migrations/add-user-ename-constraint";
import {
    COMPANY_ONTOLOGY,
    GROUP_ONTOLOGY,
    LEGACY_GROUP_MANIFEST_ONTOLOGY,
    ManifestService,
    USER_PROFILE_ONTOLOGY,
} from "./manifest.service";

describe("ManifestService", () => {
    let driver: Driver;
    let db: DbService;
    let manifests: ManifestService;

    beforeAll(async () => {
        const setup = await setupTestNeo4j();
        driver = setup.driver;
        db = new DbService(driver);
        manifests = new ManifestService(db);

        // Duplicates an earlier race could have left, for the migration test.
        await db.runQuery(
            `CREATE (:User { eName: "@dup", publicKeys: ["k1"] }),
                    (:User { eName: "@dup", publicKeys: ["k2", "k1"], vaultType: "user", manifestId: "@m" })`,
            {},
        );
        await createUserENameConstraint(driver);
    }, 120000);

    afterAll(async () => {
        await teardownTestNeo4j();
    });

    const store = async (
        vault: string,
        ontology: string,
        payload: Record<string, any>,
    ): Promise<string> => {
        const result = await db.storeMetaEnvelope(
            { ontology, payload, acl: ["@someone-else"] },
            ["@someone-else"],
            vault,
        );
        return result.metaEnvelope.id;
    };

    /** GroupManifests in a vault, told apart from Chats sharing their ontology. */
    const groupManifestsIn = async (vault: string) =>
        (await db.findMetaEnvelopesByOntology(GROUP_ONTOLOGY, vault)).filter(
            (m) =>
                Array.isArray(m.parsed.members) &&
                typeof m.parsed.owner === "string",
        );

    describe("User eName constraint migration", () => {
        it("folds duplicate User nodes into one and keeps their fields", async () => {
            const result = await db.runQuery(
                "MATCH (u:User { eName: '@dup' }) RETURN u.publicKeys AS keys, u.manifestId AS manifestId",
                {},
            );
            expect(result.records).toHaveLength(1);
            expect([...result.records[0].get("keys")].sort()).toEqual([
                "k1",
                "k2",
            ]);
            expect(result.records[0].get("manifestId")).toBe("@m");
        });
    });

    describe("user vaults", () => {
        it("pins the UserProfile of a keyed vault and serves it despite its ACL", async () => {
            const vault = "@keyed-user";
            await db.addPublicKey(vault, "z-key");
            const id = await store(vault, USER_PROFILE_ONTOLOGY, {
                ename: vault,
                username: "keyed",
                displayName: "Keyed",
            });

            const resolved = await manifests.resolve(vault);

            expect(resolved.type).toBe("user");
            expect(resolved.manifest?.id).toBe(id);
            expect(resolved.manifest?.parsed.displayName).toBe("Keyed");
            expect((await db.getVaultConfig(vault)).manifestId).toBe(id);
        });

        it("treats a keyless vault without group records as a user", async () => {
            const vault = "@keyless-user";
            const id = await store(vault, USER_PROFILE_ONTOLOGY, {
                ename: vault,
                username: "keyless",
            });

            const resolved = await manifests.resolve(vault);

            expect(resolved.type).toBe("user");
            expect(resolved.manifest?.id).toBe(id);
        });

        it("ignores profiles that name someone else and picks the earliest self-naming one", async () => {
            const vault = "@many-profiles";
            await store(vault, USER_PROFILE_ONTOLOGY, {
                ename: "@a-contact",
                createdAt: "2020-01-01T00:00:00.000Z",
            });
            await store(vault, USER_PROFILE_ONTOLOGY, {
                ename: vault,
                createdAt: "2024-06-01T00:00:00.000Z",
            });
            const earliest = await store(vault, USER_PROFILE_ONTOLOGY, {
                ename: vault,
                createdAt: "2023-01-01T00:00:00.000Z",
            });

            expect((await manifests.resolve(vault)).manifest?.id).toBe(
                earliest,
            );
        });

        it("stays pinned once a later profile appears", async () => {
            const vault = "@stable-user";
            const first = await store(vault, USER_PROFILE_ONTOLOGY, {
                ename: vault,
                createdAt: "2024-01-01T00:00:00.000Z",
            });
            await manifests.resolve(vault);
            await store(vault, USER_PROFILE_ONTOLOGY, {
                ename: vault,
                createdAt: "2000-01-01T00:00:00.000Z",
            });

            expect((await manifests.resolve(vault)).manifest?.id).toBe(first);
        });

        it("returns no manifest and writes nothing for an unknown eName", async () => {
            const resolved = await manifests.resolve("@nobody-here");

            expect(resolved).toEqual({ type: "user", manifest: null });
            const nodes = await db.runQuery(
                "MATCH (u:User { eName: $e }) RETURN count(u) AS n",
                { e: "@nobody-here" },
            );
            expect(nodes.records[0].get("n").toNumber()).toBe(0);
        });
    });

    describe("group vaults", () => {
        it("pins the GroupManifest createGroupEVault writes, not the Chat beside it", async () => {
            const vault = "@group-with-manifest";
            await store(vault, GROUP_ONTOLOGY, {
                ename: vault,
                name: "Ops chat",
                participantIds: ["@alice"],
                createdAt: "2020-01-01T00:00:00.000Z",
            });
            const id = await store(vault, GROUP_ONTOLOGY, {
                eName: vault,
                name: "Ops",
                members: ["@alice"],
                admins: ["@alice"],
                owner: "@alice",
                createdAt: "2024-01-01T00:00:00.000Z",
            });
            await store(vault, LEGACY_GROUP_MANIFEST_ONTOLOGY, {
                eName: vault,
                name: "Older legacy",
                members: [],
                admins: [],
                owner: "@alice",
                createdAt: "2019-01-01T00:00:00.000Z",
            });

            const resolved = await manifests.resolve(vault);

            expect(resolved.type).toBe("group");
            expect(resolved.manifest?.id).toBe(id);
            expect(await groupManifestsIn(vault)).toHaveLength(1);
        });

        it("falls back to a legacy GroupManifest", async () => {
            const vault = "@group-with-legacy-manifest";
            const id = await store(vault, LEGACY_GROUP_MANIFEST_ONTOLOGY, {
                eName: vault,
                name: "Ops",
                members: ["@alice"],
                admins: ["@alice"],
                owner: "@alice",
            });

            const resolved = await manifests.resolve(vault);

            expect(resolved.type).toBe("group");
            expect(resolved.manifest?.id).toBe(id);
        });

        it("builds a GroupManifest once from an old group's Chat", async () => {
            const vault = "@old-group";
            const alice = await store("@alice", USER_PROFILE_ONTOLOGY, {
                ename: "@alice",
                username: "alice",
            });
            await store(vault, GROUP_ONTOLOGY, {
                ename: vault,
                name: "Book club",
                participantIds: ["@alice", "@bob"],
                adminIds: [alice],
            });

            const resolved = await manifests.resolve(vault);

            expect(resolved.type).toBe("group");
            expect(resolved.manifest?.ontology).toBe(GROUP_ONTOLOGY);
            expect(resolved.manifest?.parsed).toMatchObject({
                eName: vault,
                name: "Book club",
                admins: ["@alice"],
                owner: vault,
            });
            expect(
                [...(resolved.manifest?.parsed.members as string[])].sort(),
            ).toEqual(["@alice", "@bob"]);

            await manifests.resolve(vault);
            expect(await groupManifestsIn(vault)).toHaveLength(1);
        });

        it("writes a single GroupManifest under concurrent lookups", async () => {
            const vault = "@racing-group";
            await store(vault, GROUP_ONTOLOGY, {
                ename: vault,
                name: "Race",
                participantIds: ["@alice"],
            });

            const results = await Promise.all(
                Array.from({ length: 5 }, () => manifests.resolve(vault)),
            );

            expect(await groupManifestsIn(vault)).toHaveLength(1);
            const pinned = (await db.getVaultConfig(vault)).manifestId;
            for (const r of results) {
                expect(r.type).toBe("group");
                if (r.manifest) expect(r.manifest.id).toBe(pinned);
            }
        });

        it("does not treat a keyed vault holding a self-naming Chat as a group", async () => {
            const vault = "@keyed-with-chat";
            await db.addPublicKey(vault, "z-key");
            await store(vault, GROUP_ONTOLOGY, { ename: vault, name: "x" });

            expect((await manifests.resolve(vault)).type).toBe("user");
        });
    });

    describe("company vaults", () => {
        it("prefers the Company record over an earlier GroupManifest", async () => {
            const vault = "@acme";
            const groupManifest = await store(
                vault,
                LEGACY_GROUP_MANIFEST_ONTOLOGY,
                {
                    eName: vault,
                    name: "Acme",
                    members: [],
                    admins: [],
                    owner: "@founder",
                    createdAt: "2020-01-01T00:00:00.000Z",
                },
            );
            const company = await store(vault, COMPANY_ONTOLOGY, {
                id: "acme",
                eName: vault,
                groupManifestEnvelopeId: groupManifest,
                legalName: "Acme Ltd",
                createdAt: "2024-01-01T00:00:00.000Z",
                updatedAt: "2024-01-01T00:00:00.000Z",
            });

            const resolved = await manifests.resolve(vault);

            expect(resolved.type).toBe("company");
            expect(resolved.manifest?.id).toBe(company);
            expect(resolved.manifest?.parsed.legalName).toBe("Acme Ltd");
        });
    });

    describe("deleted manifests", () => {
        it("re-resolves when the pinned record is gone", async () => {
            const vault = "@deleted-pin";
            const first = await store(vault, USER_PROFILE_ONTOLOGY, {
                ename: vault,
                createdAt: "2020-01-01T00:00:00.000Z",
            });
            const second = await store(vault, USER_PROFILE_ONTOLOGY, {
                ename: vault,
                createdAt: "2021-01-01T00:00:00.000Z",
            });
            await manifests.resolve(vault);
            await db.deleteMetaEnvelope(first, vault);
            // Age the pin past the grace window.
            await db.runQuery(
                "MATCH (u:User { eName: $e }) SET u.manifestPinnedAt = 0",
                { e: vault },
            );

            expect((await manifests.resolve(vault)).manifest?.id).toBe(second);
        });
    });
});
