import { describe, expect, it } from "vitest";
import {
    type ChainSource,
    checkDelegatedSignature,
    type DelegationRecord,
    evaluateDelegation,
    isWindowWithin,
    type RoleRecord,
} from "./chain";
import type { DelegatedSignPayload } from "./payloads";

const NDA = "@esigner:nda";
const INVOICE = "ontology:11111111-2222-4333-8444-555555555555";
const NOW = new Date("2026-10-07T12:00:00.000Z");

const role = (over: Partial<RoleRecord> = {}): RoleRecord => ({
    companyEName: "@acme",
    title: "Head of Finance",
    scopes: [NDA, INVOICE],
    mayRedelegate: true,
    status: "active",
    appLimits: { maxAmount: 10000 },
    ...over,
});

const delegation = (
    over: Partial<DelegationRecord> = {},
): DelegationRecord => ({
    companyEName: "@acme",
    delegateEName: "@bob",
    roleId: "r1",
    title: "Head of Finance",
    scopes: [NDA, INVOICE],
    mayRedelegate: true,
    grantedBy: "@dir",
    status: "active",
    ...over,
});

function source(
    roles: Record<string, RoleRecord>,
    delegations: Record<string, DelegationRecord>,
): ChainSource {
    return {
        role: async (id) => roles[id] ?? null,
        delegation: async (id) => delegations[id] ?? null,
    };
}

const evaluate = (id: string, src: ChainSource) =>
    evaluateDelegation(id, src, { now: NOW });

describe("evaluateDelegation", () => {
    it("accepts a role assignment", async () => {
        const result = await evaluate(
            "d1",
            source({ r1: role() }, { d1: delegation() }),
        );
        expect(result).toMatchObject({
            ok: true,
            delegateEName: "@bob",
            scopes: [NDA, INVOICE],
            chain: ["d1"],
            roleId: "r1",
            appLimits: [{ maxAmount: 10000 }],
        });
    });

    it("accepts a narrowing re-delegation and collects every link's limits", async () => {
        const child = delegation({
            delegateEName: "@carol",
            roleId: undefined,
            parentDelegationId: "d1",
            title: "NDA signer",
            scopes: [NDA],
            mayRedelegate: false,
            grantedBy: "@bob",
            appLimits: { maxAmount: 500 },
        });
        const result = await evaluate(
            "d2",
            source({ r1: role() }, { d1: delegation(), d2: child }),
        );
        expect(result).toMatchObject({
            ok: true,
            delegateEName: "@carol",
            title: "NDA signer",
            scopes: [NDA],
            chain: ["d2", "d1"],
            appLimits: [{ maxAmount: 10000 }, { maxAmount: 500 }],
        });
    });

    it.each([
        ["revoked", {}, { status: "revoked" as const }, "REVOKED"],
        ["expired", {}, { validUntil: "2026-01-01T00:00:00.000Z" }, "EXPIRED"],
        [
            "not yet valid",
            {},
            { validFrom: "2027-01-01T00:00:00.000Z" },
            "NOT_YET_VALID",
        ],
        [
            "a core scope",
            { scopes: ["@w3ds:auth"] },
            { scopes: ["@w3ds:auth"] },
            "CORE_SCOPE",
        ],
        [
            "re-delegable under a closed role",
            { mayRedelegate: false },
            {},
            "REDELEGATION_NOT_ALLOWED",
        ],
        [
            "for another company",
            { companyEName: "@other" },
            {},
            "WRONG_COMPANY",
        ],
        ["dated with garbage", {}, { validUntil: "not-a-date" }, "MALFORMED"],
    ])(
        "rejects a delegation that is %s",
        async (_name, roleOver, delOver, code) => {
            const result = await evaluate(
                "d1",
                source({ r1: role(roleOver) }, { d1: delegation(delOver) }),
            );
            expect(result).toMatchObject({ ok: false, code });
        },
    );

    it("narrows to what the role covers now", async () => {
        const result = await evaluate(
            "d1",
            source({ r1: role({ scopes: [NDA] }) }, { d1: delegation() }),
        );
        expect(result).toMatchObject({ ok: true, scopes: [NDA] });
    });

    it("keeps a child granted before its parent was revoked", async () => {
        const result = await evaluate(
            "d2",
            source(
                { r1: role() },
                {
                    d1: delegation({
                        status: "revoked",
                        createdAt: "2026-01-01T00:00:00.000Z",
                        revokedAt: "2026-06-01T00:00:00.000Z",
                    }),
                    d2: delegation({
                        roleId: undefined,
                        parentDelegationId: "d1",
                        grantedBy: "@bob",
                        delegateEName: "@carol",
                        mayRedelegate: false,
                        createdAt: "2026-03-01T00:00:00.000Z",
                    }),
                },
            ),
        );
        expect(result).toMatchObject({ ok: true, delegateEName: "@carol" });
    });

    it("drops a child when its parent's revocation cascades", async () => {
        const result = await evaluate(
            "d2",
            source(
                { r1: role() },
                {
                    d1: delegation({
                        status: "revoked",
                        revocationCascade: true,
                        createdAt: "2026-01-01T00:00:00.000Z",
                        revokedAt: "2026-06-01T00:00:00.000Z",
                    }),
                    d2: delegation({
                        roleId: undefined,
                        parentDelegationId: "d1",
                        grantedBy: "@bob",
                        delegateEName: "@carol",
                        mayRedelegate: false,
                        createdAt: "2026-03-01T00:00:00.000Z",
                    }),
                },
            ),
        );
        expect(result).toMatchObject({ ok: false, code: "REVOKED", at: "d1" });
    });

    it("rejects a revoked role", async () => {
        const result = await evaluate(
            "d1",
            source({ r1: role({ status: "revoked" }) }, { d1: delegation() }),
        );
        expect(result).toMatchObject({ ok: false, code: "REVOKED", at: "r1" });
    });

    it("rejects re-delegation from a parent that forbids it", async () => {
        const result = await evaluate(
            "d2",
            source(
                { r1: role() },
                {
                    d1: delegation({ mayRedelegate: false }),
                    d2: delegation({
                        roleId: undefined,
                        parentDelegationId: "d1",
                        mayRedelegate: false,
                        grantedBy: "@bob",
                        delegateEName: "@carol",
                    }),
                },
            ),
        );
        expect(result).toMatchObject({
            ok: false,
            code: "REDELEGATION_NOT_ALLOWED",
        });
    });

    it("rejects a child granted by someone other than the parent's delegate", async () => {
        const result = await evaluate(
            "d2",
            source(
                { r1: role() },
                {
                    d1: delegation(),
                    d2: delegation({
                        roleId: undefined,
                        parentDelegationId: "d1",
                        grantedBy: "@mallory",
                    }),
                },
            ),
        );
        expect(result).toMatchObject({ ok: false, code: "WRONG_GRANTOR" });
    });

    it("rejects a child that names both a role and a parent", async () => {
        const result = await evaluate(
            "d1",
            source(
                { r1: role() },
                { d1: delegation({ parentDelegationId: "d0" }) },
            ),
        );
        expect(result).toMatchObject({ ok: false, code: "MALFORMED" });
    });

    it("stops on cycles", async () => {
        const result = await evaluate(
            "a",
            source(
                {},
                {
                    a: delegation({
                        roleId: undefined,
                        parentDelegationId: "b",
                        grantedBy: "@bob",
                    }),
                    b: delegation({
                        roleId: undefined,
                        parentDelegationId: "a",
                        grantedBy: "@bob",
                    }),
                },
            ),
        );
        expect(result).toMatchObject({ ok: false, code: "CYCLE" });
    });

    it("rejects a parent that is no longer live", async () => {
        const result = await evaluate(
            "d2",
            source(
                { r1: role() },
                {
                    d1: delegation({ status: "revoked" }),
                    d2: delegation({
                        roleId: undefined,
                        parentDelegationId: "d1",
                        grantedBy: "@bob",
                        delegateEName: "@carol",
                        mayRedelegate: false,
                    }),
                },
            ),
        );
        expect(result).toMatchObject({ ok: false, code: "REVOKED", at: "d1" });
    });
});

describe("isWindowWithin", () => {
    it("requires the child's window inside the parent's", () => {
        const parent = {
            status: "active" as const,
            validUntil: "2027-01-01T00:00:00.000Z",
        };
        expect(
            isWindowWithin(
                { status: "active", validUntil: "2026-12-01T00:00:00.000Z" },
                parent,
            ),
        ).toBe(true);
        expect(isWindowWithin({ status: "active" }, parent)).toBe(false);
    });
});

describe("checkDelegatedSignature", () => {
    const payload: DelegatedSignPayload = {
        onBehalfOf: "@acme",
        signer: "@bob",
        scope: NDA,
        delegationId: "d1",
        documentHash: "h",
        session: "s",
        issuedAt: NOW.toISOString(),
    };

    it("accepts a payload within the chain", async () => {
        const chain = await evaluate(
            "d1",
            source({ r1: role() }, { d1: delegation() }),
        );
        expect(checkDelegatedSignature(payload, chain)).toBeNull();
    });

    it.each([
        [{ onBehalfOf: "@other" }, "WRONG_COMPANY"],
        [{ signer: "@mallory" }, "WRONG_SIGNER"],
        [{ delegationId: "d9" }, "WRONG_DELEGATION"],
        [{ scope: "@w3ds:auth" }, "CORE_SCOPE"],
        [{ scope: "@esigner:invoice" }, "SCOPE_NOT_DELEGATED"],
    ])("rejects %o", async (over, code) => {
        const chain = await evaluate(
            "d1",
            source({ r1: role() }, { d1: delegation() }),
        );
        expect(
            checkDelegatedSignature({ ...payload, ...over }, chain),
        ).toMatchObject({ code });
    });

    it("rejects when the chain is invalid", async () => {
        const chain = await evaluate("d1", source({}, { d1: delegation() }));
        expect(checkDelegatedSignature(payload, chain)).toMatchObject({
            code: "CHAIN_INVALID",
        });
    });
});
