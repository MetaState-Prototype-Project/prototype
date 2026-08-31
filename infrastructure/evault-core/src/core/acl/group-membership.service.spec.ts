import type { Driver } from "neo4j-driver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    setupTestNeo4j,
    teardownTestNeo4j,
} from "../../test-utils/neo4j-setup";
import { DbService } from "../db/db.service";
import { GroupMembershipService } from "./group-membership.service";

const GROUP_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440003";
const GROUP_MANIFEST_ONTOLOGY = "a8bfb7cf-3200-4b25-9ea9-ee41100f212e";
const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

describe("GroupMembershipService", () => {
    let driver: Driver;
    let db: DbService;
    let groups: GroupMembershipService;

    beforeAll(async () => {
        const setup = await setupTestNeo4j();
        driver = setup.driver;
        db = new DbService(driver);
        groups = new GroupMembershipService(db);
    }, 120000);

    afterAll(async () => {
        await teardownTestNeo4j();
    });

    /** Stores a profile record and returns the id a group would reference it by. */
    const storeProfile = async (
        vault: string,
        payload: Record<string, any> = {},
    ): Promise<string> => {
        const result = await db.storeMetaEnvelope(
            {
                ontology: USER_ONTOLOGY,
                payload: { username: "someone", ...payload },
                acl: ["*"],
            },
            ["*"],
            vault,
        );
        return result.metaEnvelope.id;
    };

    const storeGroup = async (
        vault: string,
        payload: Record<string, any>,
        ontology = GROUP_ONTOLOGY,
    ): Promise<string> => {
        const result = await db.storeMetaEnvelope(
            { ontology, payload, acl: ["*"] },
            ["*"],
            vault,
        );
        return result.metaEnvelope.id;
    };

    describe("members named by eName", () => {
        it("resolves a manifest whose members are eNames", async () => {
            const group = "@group-by-ename";
            await storeGroup(
                group,
                {
                    ename: group,
                    name: "Ops",
                    members: ["@alice", "@bob"],
                    admins: ["@alice"],
                    owner: "@alice",
                },
                GROUP_MANIFEST_ONTOLOGY,
            );

            const members = await groups.membersOf(group);
            expect(members.sort()).toEqual(["@alice", "@bob"]);
        });

        it("finds the group by the ename field when it lives in another vault", async () => {
            const group = "@group-stated-ename";
            // The record sits in a platform's vault, naming the group itself.
            await storeGroup("@some-other-vault", {
                ename: group,
                name: "Stated",
                members: ["@carol"],
            });

            expect(await groups.membersOf(group)).toEqual(["@carol"]);
        });
    });

    describe("members named by profile envelope id", () => {
        it("follows a participant id to the eName the profile states", async () => {
            const group = "@group-by-id";
            // The profile lives in one vault but states whose it is; the stated
            // eName is what a participant id must resolve to.
            const profileId = await storeProfile("@holding-vault", {
                ename: "@dave",
            });
            await storeGroup(group, {
                ename: group,
                name: "By id",
                participantIds: [profileId],
            });

            expect(await groups.membersOf(group)).toEqual(["@dave"]);
        });

        it("falls back to the vault the profile lives in when it states nothing", async () => {
            const group = "@group-by-id-fallback";
            const profileId = await storeProfile("@erin");
            await storeGroup(group, {
                ename: group,
                name: "Fallback",
                participantIds: [profileId],
            });

            expect(await groups.membersOf(group)).toEqual(["@erin"]);
        });

        it("ignores an id that resolves to nothing", async () => {
            const group = "@group-dangling-id";
            await storeGroup(group, {
                ename: group,
                name: "Dangling",
                participantIds: ["00000000-0000-0000-0000-000000000000"],
            });

            expect(await groups.membersOf(group)).toEqual([]);
        });
    });

    describe("mixed and awkward shapes", () => {
        it("resolves a list holding both eNames and profile ids", async () => {
            const group = "@group-mixed";
            const frankId = await storeProfile("@frank");
            await storeGroup(group, {
                ename: group,
                name: "Mixed",
                participantIds: [frankId, "@grace"],
            });

            expect((await groups.membersOf(group)).sort()).toEqual([
                "@frank",
                "@grace",
            ]);
        });

        it("unions every participant field a record carries", async () => {
            const group = "@group-many-fields";
            const heidiId = await storeProfile("@heidi");
            await storeGroup(group, {
                ename: group,
                name: "Many",
                members: ["@ivan"],
                participantIds: [heidiId],
                admins: ["@judy"],
                owner: "@judy",
            });

            expect((await groups.membersOf(group)).sort()).toEqual([
                "@heidi",
                "@ivan",
                "@judy",
            ]);
        });

        it("deduplicates a member reachable two ways", async () => {
            const group = "@group-dupes";
            const kenId = await storeProfile("@holding", { ename: "@ken" });
            await storeGroup(group, {
                ename: group,
                name: "Dupes",
                members: ["@ken"],
                participantIds: [kenId],
                admins: ["@ken"],
            });

            expect(await groups.membersOf(group)).toEqual(["@ken"]);
        });

        it("reads a single-value owner field as one member", async () => {
            const group = "@group-scalar-owner";
            await storeGroup(group, {
                ename: group,
                name: "Scalar",
                owner: "@leo",
            });

            expect(await groups.membersOf(group)).toEqual(["@leo"]);
        });

        it("returns nothing for an unknown group", async () => {
            expect(
                await groups.membersOf("@group-that-does-not-exist"),
            ).toEqual([]);
        });

        it("returns nothing for a value that is not an eName", async () => {
            expect(await groups.membersOf("not-an-ename")).toEqual([]);
        });

        it("ignores records that are not groups", async () => {
            const notAGroup = "@not-a-group";
            await storeProfile(notAGroup, {
                ename: notAGroup,
                members: ["@mallory"],
            });

            expect(await groups.membersOf(notAGroup)).toEqual([]);
        });
    });
});
