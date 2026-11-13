import { describe, expect, it } from "vitest";
import {
    aclBlockFromInput,
    emptyAclBlock,
    evaluate,
    fromLegacyAcl,
    mostSpecificGrant,
    normalizeAclBlock,
    resolveAclBlock,
    validatePerms,
} from "./acl";
import type {
    AclBlock,
    Condition,
    ConditionEvaluator,
    Principal,
} from "./types";
import { Permission } from "./types";

const USER = "@7b9c2e1a-4f30-4c5e-9a21-d8e0f1a2b3c4";
const PLATFORM = "@2d4f6a8b-1c3e-4d5f-8a9b-0c1d2e3f4a5b";
const BAD_PLATFORM = "@platform-bad1";
const GROUP = "@9f0e1d2c-3b4a-5968-7766-554433221100";
const EREP = "@1a1a1a1a-0000-0000-0000-000000000001";
const SEC = "@2b2b2b2b-0000-0000-0000-000000000002";

const user = (over: Partial<Principal> = {}): Principal => ({
    ename: USER,
    kind: "user",
    ...over,
});
const platform = (
    ename = PLATFORM,
    over: Partial<Principal> = {},
): Principal => ({
    ename,
    kind: "platform",
    ...over,
});

const block = (over: Partial<AclBlock> = {}): AclBlock => ({
    ...emptyAclBlock(),
    ...over,
});

/** Answers conditions from a flat table of ontology eName -> score. */
const scores = (
    table: Record<string, Record<string, number>>,
): ConditionEvaluator => ({
    async passes(condition: Condition, principal: Principal) {
        const value = table[principal.ename]?.[condition.ontology];
        if (typeof value !== "number") return false;
        switch (condition.op) {
            case ">=":
                return value >= condition.value;
            case ">":
                return value > condition.value;
            case "<=":
                return value <= condition.value;
            case "<":
                return value < condition.value;
            case "==":
                return value === condition.value;
        }
    },
});

const cond = (
    ontology: string,
    op: Condition["op"],
    value: number,
    path = "$.score",
): Condition => ({ ontology, path, op, value });

describe("permission bits", () => {
    it("rejects reserved bits on a write", () => {
        expect(() => validatePerms(0x10)).toThrow(/reserved/);
        expect(() => validatePerms(0xff)).toThrow(/reserved/);
    });

    it("accepts the documented combinations", () => {
        expect(validatePerms(0x0f)).toBe(Permission.ALL);
        expect(validatePerms(0x01)).toBe(Permission.READ);
        // Read plus add-only: create without update.
        expect(validatePerms(0x03)).toBe(Permission.READ | Permission.CREATE);
    });

    it("strips reserved bits from stored data rather than trusting them", () => {
        const normalized = normalizeAclBlock({
            grants: [{ ename: USER, perms: 0xf1 }],
        });
        expect(normalized.grants[0].perms).toBe(Permission.READ);
    });

    it("treats a 0x00 grant as no grant", () => {
        const normalized = normalizeAclBlock({
            grants: [{ ename: USER, perms: 0x00 }],
        });
        expect(normalized.grants).toEqual([]);
    });
});

describe("evaluate: action validation", () => {
    it("rejects an action that is not exactly one bit", async () => {
        await expect(evaluate(block(), user(), 0x03)).rejects.toThrow(
            /exactly one/,
        );
        await expect(evaluate(block(), user(), 0x00)).rejects.toThrow(
            /exactly one/,
        );
    });
});

describe("evaluate: step 2, most specific grant wins", () => {
    // Normative example: a group grant of READ+UPDATE and a direct user grant of
    // READ leave that user with READ only.
    const acl = block({
        grants: [
            { ename: GROUP, perms: 0x05 },
            { ename: USER, perms: 0x01 },
        ],
    });
    const member = user({ groups: [GROUP] });

    it("allows the action the specific grant carries", async () => {
        const decision = await evaluate(acl, member, Permission.READ);
        expect(decision).toMatchObject({
            allowed: true,
            reason: "grant",
            perms: 0x01,
        });
    });

    it("does not union the less specific group grant into it", async () => {
        const decision = await evaluate(acl, member, Permission.UPDATE);
        expect(decision).toMatchObject({ allowed: false, reason: "grant" });
    });

    it("still applies the group grant to a member with no direct grant", async () => {
        const other = {
            ename: "@someone-else",
            kind: "user" as const,
            groups: [GROUP],
        };
        const decision = await evaluate(acl, other, Permission.UPDATE);
        expect(decision.allowed).toBe(true);
    });

    it("ranks a user grant above a platform grant above a group grant", async () => {
        const principal = user({ platform: PLATFORM, groups: [GROUP] });
        expect(
            await mostSpecificGrant(
                [
                    { ename: GROUP, perms: 0x0f },
                    { ename: PLATFORM, perms: 0x07 },
                    { ename: USER, perms: 0x01 },
                ],
                principal,
            ),
        ).toMatchObject({ perms: 0x01 });

        expect(
            await mostSpecificGrant(
                [
                    { ename: GROUP, perms: 0x0f },
                    { ename: PLATFORM, perms: 0x07 },
                ],
                principal,
            ),
        ).toMatchObject({ perms: 0x07 });
    });

    it("unions grants tied at the same specificity", async () => {
        const principal = user({ groups: ["@group-a", "@group-b"] });
        expect(
            await mostSpecificGrant(
                [
                    { ename: "@group-a", perms: 0x01 },
                    { ename: "@group-b", perms: 0x04 },
                ],
                principal,
            ),
        ).toMatchObject({ perms: 0x05 });
    });

    it("does not fall through to the ontology when a grant exists but lacks the action", async () => {
        const acl = block({
            grants: [{ ename: PLATFORM, perms: 0x01 }],
            default_perms: Permission.ALL,
            require: [[]],
        });
        const decision = await evaluate(acl, platform(), Permission.DELETE);
        expect(decision).toMatchObject({ allowed: false, reason: "grant" });
    });
});

describe("evaluate: step 1, denials always win", () => {
    it("refuses a party that is both granted and denied by name", async () => {
        // Normative example: a grant and a denial naming the same platform.
        const acl = block({
            grants: [{ ename: PLATFORM, perms: Permission.READ }],
            denials: { enames: [PLATFORM], conditions: [] },
        });
        const decision = await evaluate(acl, platform(), Permission.READ);
        expect(decision).toMatchObject({
            allowed: false,
            reason: "denied_by_ename",
        });
    });

    it("denies through the platform acting for a user", async () => {
        const acl = block({
            grants: [{ ename: USER, perms: Permission.ALL }],
            denials: { enames: [BAD_PLATFORM], conditions: [] },
        });
        const decision = await evaluate(
            acl,
            user({ platform: BAD_PLATFORM }),
            Permission.READ,
        );
        expect(decision).toMatchObject({
            allowed: false,
            reason: "denied_by_ename",
        });
    });

    it("denies through a group the party belongs to", async () => {
        const acl = block({
            grants: [{ ename: USER, perms: Permission.ALL }],
            denials: { enames: [GROUP], conditions: [] },
        });
        const decision = await evaluate(
            acl,
            user({ groups: [GROUP] }),
            Permission.READ,
        );
        expect(decision).toMatchObject({
            allowed: false,
            reason: "denied_by_ename",
        });
    });

    it("denies a party that fails a deny condition", async () => {
        // A deny condition removes access from anyone who does not clear it.
        const acl = block({
            grants: [{ ename: PLATFORM, perms: Permission.ALL }],
            denials: { enames: [], conditions: [cond(EREP, ">=", 60)] },
        });
        const evaluator = scores({ [PLATFORM]: { [EREP]: 20 } });
        const decision = await evaluate(acl, platform(), Permission.READ, {
            conditions: evaluator,
        });
        expect(decision).toMatchObject({
            allowed: false,
            reason: "denied_by_condition",
        });
    });

    it("lets a party that clears the deny condition through to its grant", async () => {
        const acl = block({
            grants: [{ ename: PLATFORM, perms: Permission.ALL }],
            denials: { enames: [], conditions: [cond(EREP, ">=", 60)] },
        });
        const evaluator = scores({ [PLATFORM]: { [EREP]: 72 } });
        const decision = await evaluate(acl, platform(), Permission.READ, {
            conditions: evaluator,
        });
        expect(decision).toMatchObject({ allowed: true, reason: "grant" });
    });
});

describe("evaluate: step 3, the ontology groups", () => {
    // Normative example: clear security AND reputation together, or clear a
    // higher reputation bar alone.
    const acl = block({
        grants: [{ ename: PLATFORM, perms: 0x01 }],
        denials: { enames: [BAD_PLATFORM], conditions: [] },
        default_perms: 0x01,
        require: [
            [cond(SEC, ">=", 80), cond(EREP, ">=", 60)],
            [cond(EREP, ">=", 90)],
        ],
    });

    it("runs the end-to-end example", async () => {
        const unnamedA = "@platform-unnamed-a";
        const unnamedB = "@platform-unnamed-b";
        const evaluator = scores({
            [unnamedA]: { [SEC]: 84, [EREP]: 72 },
            [unnamedB]: { [EREP]: 95 },
        });

        // Denied at step 1.
        expect(
            (
                await evaluate(acl, platform(BAD_PLATFORM), Permission.READ, {
                    conditions: evaluator,
                })
            ).allowed,
        ).toBe(false);

        // Allowed at step 2 -- 0x01 includes READ.
        expect(
            await evaluate(acl, platform(), Permission.READ, {
                conditions: evaluator,
            }),
        ).toMatchObject({ allowed: true, reason: "grant" });

        // Denied -- 0x01 lacks DELETE, and step 3 is not reached.
        expect(
            await evaluate(acl, platform(), Permission.DELETE, {
                conditions: evaluator,
            }),
        ).toMatchObject({ allowed: false, reason: "grant" });

        // Group A passes, so READ is allowed at step 3.
        expect(
            await evaluate(acl, platform(unnamedA), Permission.READ, {
                conditions: evaluator,
            }),
        ).toMatchObject({ allowed: true, reason: "ontology" });

        // Group A fails on the missing security score, but Group B passes.
        expect(
            await evaluate(acl, platform(unnamedB), Permission.READ, {
                conditions: evaluator,
            }),
        ).toMatchObject({ allowed: true, reason: "ontology" });
    });

    it("refuses an unnamed party that clears no group", async () => {
        const weak = "@platform-weak";
        const evaluator = scores({ [weak]: { [SEC]: 10, [EREP]: 10 } });
        expect(
            await evaluate(acl, platform(weak), Permission.READ, {
                conditions: evaluator,
            }),
        ).toMatchObject({ allowed: false, reason: "no_matching_group" });
    });

    it("caps a passing party at default_perms", async () => {
        const strong = "@platform-strong";
        const evaluator = scores({ [strong]: { [EREP]: 99 } });
        expect(
            (
                await evaluate(acl, platform(strong), Permission.UPDATE, {
                    conditions: evaluator,
                })
            ).allowed,
        ).toBe(false);
    });

    it("fails a condition whose value is missing rather than passing it", async () => {
        const evaluator = scores({});
        expect(
            (
                await evaluate(acl, platform("@unknown"), Permission.READ, {
                    conditions: evaluator,
                })
            ).allowed,
        ).toBe(false);
    });

    it("fails closed when no evaluator is wired in", async () => {
        expect(
            (await evaluate(acl, platform("@unknown"), Permission.READ))
                .allowed,
        ).toBe(false);
    });

    it("fails closed when the evaluator throws", async () => {
        const throwing: ConditionEvaluator = {
            async passes() {
                throw new Error("registry unreachable");
            },
        };
        expect(
            (
                await evaluate(acl, platform("@unknown"), Permission.READ, {
                    conditions: throwing,
                })
            ).allowed,
        ).toBe(false);
    });

    it("refuses everyone when require is empty", async () => {
        const closed = block({ default_perms: Permission.ALL });
        expect(
            (await evaluate(closed, platform("@anyone"), Permission.READ))
                .allowed,
        ).toBe(false);
    });
});

describe("legacy acl arrays", () => {
    it("maps the wildcard onto full access for anyone", async () => {
        const acl = fromLegacyAcl(["*"]);
        for (const action of [
            Permission.READ,
            Permission.CREATE,
            Permission.UPDATE,
            Permission.DELETE,
        ]) {
            expect(
                (await evaluate(acl, platform("@whoever"), action)).allowed,
            ).toBe(true);
        }
    });

    it("maps a listed eName onto a full grant and admits nobody else", async () => {
        const acl = fromLegacyAcl([USER]);
        expect((await evaluate(acl, user(), Permission.DELETE)).allowed).toBe(
            true,
        );
        expect(
            (await evaluate(acl, user({ ename: "@other" }), Permission.READ))
                .allowed,
        ).toBe(false);
    });

    it("treats an empty or absent array as no access", async () => {
        expect(
            (await evaluate(fromLegacyAcl([]), user(), Permission.READ))
                .allowed,
        ).toBe(false);
        expect(
            (await evaluate(fromLegacyAcl(undefined), user(), Permission.READ))
                .allowed,
        ).toBe(false);
    });

    it("prefers an explicit _acl block over the legacy array", async () => {
        const resolved = resolveAclBlock({
            _acl: { v: 1, grants: [{ ename: USER, perms: 0x01 }] },
            acl: ["*"],
        });
        expect(
            (await evaluate(resolved, user(), Permission.DELETE)).allowed,
        ).toBe(false);
        expect(
            (await evaluate(resolved, user(), Permission.READ)).allowed,
        ).toBe(true);
    });

    it("falls back to the legacy array when no block is stored", async () => {
        const resolved = resolveAclBlock({ acl: ["*"] });
        expect(
            (await evaluate(resolved, platform("@whoever"), Permission.UPDATE))
                .allowed,
        ).toBe(true);
    });
});

describe("normalizeAclBlock", () => {
    it("drops malformed entries rather than trusting them", () => {
        const normalized = normalizeAclBlock({
            grants: [
                { ename: USER, perms: 0x01 },
                { perms: 0x0f },
                "nonsense",
                null,
            ],
            denials: {
                enames: [PLATFORM, 42],
                conditions: [
                    { ontology: EREP, path: "$.score", op: "~=", value: 1 },
                ],
            },
            default_perms: "lots",
            require: [
                [{ ontology: EREP, path: "$.score", op: ">=", value: 60 }],
                "nope",
            ],
        });

        expect(normalized.grants).toEqual([{ ename: USER, perms: 0x01 }]);
        expect(normalized.denials.enames).toEqual([PLATFORM]);
        // An unknown operator is not a condition we can honour, so it is dropped.
        expect(normalized.denials.conditions).toEqual([]);
        expect(normalized.default_perms).toBe(Permission.NONE);
        expect(normalized.require).toHaveLength(1);
    });

    it("returns an empty policy for junk input", () => {
        expect(normalizeAclBlock(null)).toEqual(emptyAclBlock());
        expect(normalizeAclBlock("nope")).toEqual(emptyAclBlock());
    });
});

describe("aclBlockFromInput: caller input is validated strictly", () => {
    const ok = {
        v: 1,
        grants: [{ ename: USER, perms: 0x01 }],
        denials: { enames: [], conditions: [] },
        default_perms: 0x00,
        require: [],
    };

    it("accepts a well-formed block and returns undefined for none", () => {
        expect(aclBlockFromInput(ok)?.grants).toEqual([
            { ename: USER, perms: 0x01 },
        ]);
        expect(aclBlockFromInput(undefined)).toBeUndefined();
        expect(aclBlockFromInput(null)).toBeUndefined();
    });

    it("rejects a deny condition it cannot parse rather than dropping it", () => {
        // Dropping this would remove a denial and widen access.
        expect(() =>
            aclBlockFromInput({
                ...ok,
                denials: {
                    enames: [],
                    conditions: [
                        {
                            ontology: EREP,
                            path: "$.score",
                            op: "~=",
                            value: 60,
                        },
                    ],
                },
            }),
        ).toThrow(/unknown operator/);
    });

    it("rejects a malformed require condition, naming where it is", () => {
        expect(() =>
            aclBlockFromInput({
                ...ok,
                require: [
                    [
                        {
                            ontology: EREP,
                            path: "$.score",
                            op: ">=",
                            value: "sixty",
                        },
                    ],
                ],
            }),
        ).toThrow(/require\[0\]\[0\] needs a finite numeric value/);
    });

    it("rejects a grant with no ename", () => {
        expect(() =>
            aclBlockFromInput({ ...ok, grants: [{ perms: 0x01 }] }),
        ).toThrow(/each grant needs an ename/);
    });

    it("rejects reserved permission bits", () => {
        expect(() =>
            aclBlockFromInput({
                ...ok,
                grants: [{ ename: USER, perms: 0x10 }],
            }),
        ).toThrow(/reserved/);
        expect(() => aclBlockFromInput({ ...ok, default_perms: 0xff })).toThrow(
            /reserved/,
        );
    });

    it("rejects a version it does not understand", () => {
        expect(() => aclBlockFromInput({ ...ok, v: 2 })).toThrow(
            /Unsupported _acl version: 2/,
        );
    });

    it("rejects wrong container shapes", () => {
        expect(() => aclBlockFromInput([])).toThrow(/expected an object/);
        expect(() => aclBlockFromInput({ ...ok, grants: {} })).toThrow(
            /grants must be an array/,
        );
        expect(() => aclBlockFromInput({ ...ok, require: [{}] })).toThrow(
            /require\[0\] must be an array/,
        );
    });

    it("still reads malformed *stored* data liberally", () => {
        // Stored data is normalised, not rejected -- a corrupt record must stay
        // readable, and dropping an unparseable grant there only narrows access.
        expect(normalizeAclBlock({ grants: [{ perms: 0x01 }] }).grants).toEqual(
            [],
        );
    });
});

describe("group resolution", () => {
    const GROUP_A = "@group-a";
    const GROUP_B = "@group-b";

    /** Resolves from a fixed table; anything else is an empty group. */
    const groups = (table: Record<string, string[]>) => ({
        async membersOf(group: string) {
            return table[group] ?? [];
        },
    });

    const failing = {
        async membersOf(): Promise<string[]> {
            throw new Error("group vault unreachable");
        },
    };

    it("applies a grant to a group the party belongs to", async () => {
        const acl = block({ grants: [{ ename: GROUP_A, perms: 0x05 }] });
        const resolver = groups({ [GROUP_A]: [USER] });
        expect(
            await evaluate(acl, user(), Permission.UPDATE, {
                groups: resolver,
            }),
        ).toMatchObject({ allowed: true, reason: "grant" });
    });

    it("does not apply a group grant to a non-member", async () => {
        const acl = block({ grants: [{ ename: GROUP_A, perms: 0x05 }] });
        const resolver = groups({ [GROUP_A]: ["@someone-else"] });
        expect(
            (
                await evaluate(acl, user(), Permission.UPDATE, {
                    groups: resolver,
                })
            ).allowed,
        ).toBe(false);
    });

    it("matches a group through the platform carrying the request", async () => {
        const acl = block({ grants: [{ ename: GROUP_A, perms: 0x01 }] });
        const resolver = groups({ [GROUP_A]: [PLATFORM] });
        expect(
            (
                await evaluate(acl, platform(), Permission.READ, {
                    groups: resolver,
                })
            ).allowed,
        ).toBe(true);
    });

    it("keeps a direct grant ahead of a group grant", async () => {
        const acl = block({
            grants: [
                { ename: GROUP_A, perms: 0x0f },
                { ename: USER, perms: 0x01 },
            ],
        });
        const resolver = groups({ [GROUP_A]: [USER] });
        expect(
            (
                await evaluate(acl, user(), Permission.DELETE, {
                    groups: resolver,
                })
            ).allowed,
        ).toBe(false);
    });

    it("does not resolve any group when a direct grant already matched", async () => {
        let calls = 0;
        const counting = {
            async membersOf() {
                calls++;
                return [USER];
            },
        };
        const acl = block({
            grants: [
                { ename: GROUP_A, perms: 0x0f },
                { ename: USER, perms: 0x01 },
            ],
        });
        await evaluate(acl, user(), Permission.READ, { groups: counting });
        expect(calls).toBe(0);
    });

    it("unions grants from several groups the party belongs to", async () => {
        const acl = block({
            grants: [
                { ename: GROUP_A, perms: 0x01 },
                { ename: GROUP_B, perms: 0x04 },
            ],
        });
        const resolver = groups({ [GROUP_A]: [USER], [GROUP_B]: [USER] });
        for (const action of [Permission.READ, Permission.UPDATE]) {
            expect(
                (await evaluate(acl, user(), action, { groups: resolver }))
                    .allowed,
            ).toBe(true);
        }
        expect(
            (
                await evaluate(acl, user(), Permission.DELETE, {
                    groups: resolver,
                })
            ).allowed,
        ).toBe(false);
    });

    it("denies a member of a denied group", async () => {
        const acl = block({
            grants: [{ ename: USER, perms: 0x0f }],
            denials: { enames: [GROUP_A], conditions: [] },
        });
        const resolver = groups({ [GROUP_A]: [USER] });
        expect(
            await evaluate(acl, user(), Permission.READ, { groups: resolver }),
        ).toMatchObject({ allowed: false, reason: "denied_by_ename" });
    });

    it("lets a non-member through a group denial", async () => {
        const acl = block({
            grants: [{ ename: USER, perms: 0x0f }],
            denials: { enames: [GROUP_A], conditions: [] },
        });
        const resolver = groups({ [GROUP_A]: ["@someone-else"] });
        expect(
            (await evaluate(acl, user(), Permission.READ, { groups: resolver }))
                .allowed,
        ).toBe(true);
    });

    it("holds a group denial when membership cannot be determined", async () => {
        // A lookup that failed is not evidence of non-membership, so the denial
        // stands rather than being skipped.
        const acl = block({
            grants: [{ ename: USER, perms: 0x0f }],
            denials: { enames: [GROUP_A], conditions: [] },
        });
        expect(
            await evaluate(acl, user(), Permission.READ, { groups: failing }),
        ).toMatchObject({ allowed: false, reason: "denied_by_ename" });
    });

    it("withholds a group grant when membership cannot be determined", async () => {
        // The same uncertainty must not hand out access.
        const acl = block({ grants: [{ ename: GROUP_A, perms: 0x0f }] });
        expect(
            (await evaluate(acl, user(), Permission.READ, { groups: failing }))
                .allowed,
        ).toBe(false);
    });

    it("resolves each group once per decision", async () => {
        const seen: string[] = [];
        const counting = {
            async membersOf(group: string) {
                seen.push(group);
                return [];
            },
        };
        const acl = block({
            grants: [
                { ename: GROUP_A, perms: 0x01 },
                { ename: GROUP_A, perms: 0x04 },
            ],
            denials: { enames: [GROUP_A], conditions: [] },
        });
        await evaluate(acl, user(), Permission.READ, { groups: counting });
        expect(seen).toEqual([GROUP_A]);
    });

    it("still honours a pre-resolved group list with no resolver", async () => {
        const acl = block({ grants: [{ ename: GROUP_A, perms: 0x01 }] });
        expect(
            (await evaluate(acl, user({ groups: [GROUP_A] }), Permission.READ))
                .allowed,
        ).toBe(true);
    });
});
