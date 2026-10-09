import { describe, expect, it } from "vitest";
import { sha256Hex } from "./canonical";
import { checkDelegatedSignature, evaluateDelegation } from "./chain";
import {
    boardAt,
    evaluateFromHistory,
    historyChainSource,
    type HistorySource,
    resolveBoard,
    type Version,
} from "./history";
import {
    COMPANY_ONTOLOGY,
    DELEGATION_ONTOLOGY,
    ROLE_ONTOLOGY,
} from "./ontologies";
import { buildGrantPayload } from "./payloads";

const ACME = "@acme";
const NDA = "@esigner:nda";
const INVOICE = "ontology:11111111-2222-4333-8444-555555555555";
const NOW = new Date("2026-12-01T00:00:00.000Z");

/** Only `sign` makes signatures `verify` accepts. */
const fakeSig = async (eName: string, payload: string) =>
    `sig:${eName}:${await sha256Hex(payload)}`;
const verify = async (eName: string, payload: string, signature: string) =>
    signature === (await fakeSig(eName, payload));

/** An in-memory eVault history; every write appends a version. */
class Vault implements HistorySource {
    private store = new Map<string, Version[]>();
    private clock = Date.parse("2026-10-01T00:00:00.000Z");

    write(id: string, ontology: string, parsed: Record<string, any> | null) {
        const versions = this.store.get(id) ?? [];
        this.clock += 60_000;
        versions.push({
            version: versions.length + 1,
            operation: parsed
                ? versions.length
                    ? "update"
                    : "create"
                : "delete",
            ontology,
            parsed,
            createdAt: new Date(this.clock).toISOString(),
        });
        this.store.set(id, versions);
        return this.clock;
    }

    async versions(id: string) {
        return this.store.get(id) ?? [];
    }

    /** Signs and writes, with signedAt slightly after the vault's clock. */
    async signed(
        id: string,
        ontology: string,
        signer: string,
        record: Record<string, any>,
        signedAt = new Date(this.clock + 30_000).toISOString(),
    ) {
        const { authorization: _drop, ...rest } = record;
        const signedPayload = await buildGrantPayload({
            ontology,
            companyEName: ACME,
            recordId: id,
            signerEName: signer,
            signedAt,
            record: rest,
        });
        const full = {
            ...rest,
            authorization: {
                signerEName: signer,
                signedPayload,
                signature: await fakeSig(signer, signedPayload),
                signedAt,
            },
        };
        this.write(id, ontology, full);
        return full;
    }
}

const company = (directors: string[]) => ({
    id: "acme",
    eName: ACME,
    directors,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
});

const role = (over: Record<string, any> = {}) => ({
    companyEName: ACME,
    title: "Head of Finance",
    scopes: [NDA, INVOICE],
    mayRedelegate: true,
    status: "active",
    createdBy: "@dir",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...over,
});

const delegation = (over: Record<string, any> = {}) => ({
    companyEName: ACME,
    delegateEName: "@bob",
    roleId: "role",
    title: "Head of Finance",
    scopes: [NDA, INVOICE],
    mayRedelegate: true,
    grantedBy: "@dir",
    status: "active",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...over,
});

const revoked = (record: Record<string, any>, by: string) => ({
    ...record,
    status: "revoked",
    revokedAt: "2026-10-02T00:00:00.000Z",
    revokedBy: by,
    revocationReason: "revoked",
});

/** A company with @dir on the board, a role, and Bob holding it. */
async function acme() {
    const vault = new Vault();
    await vault.signed("company", COMPANY_ONTOLOGY, "@dir", company(["@dir"]));
    await vault.signed("role", ROLE_ONTOLOGY, "@dir", role());
    await vault.signed("bob", DELEGATION_ONTOLOGY, "@dir", delegation());
    return vault;
}

const evaluate = (vault: Vault, delegationId: string) =>
    evaluateFromHistory({
        delegationId,
        companyEName: ACME,
        companyId: "company",
        source: vault,
        verify,
        now: NOW,
    });

describe("resolveBoard", () => {
    it("starts from a self-signed board and follows director-signed changes", async () => {
        const vault = new Vault();
        await vault.signed(
            "company",
            COMPANY_ONTOLOGY,
            "@dir",
            company(["@dir"]),
        );
        const added = vault.write("noise", "x", {});
        await vault.signed(
            "company",
            COMPANY_ONTOLOGY,
            "@dir",
            company(["@dir", "@eve"]),
        );
        const board = await resolveBoard("company", ACME, vault, verify);
        expect(board.map((b) => b.directors)).toEqual([
            ["@dir"],
            ["@dir", "@eve"],
        ]);
        expect(boardAt(board, added)).toEqual(["@dir"]);
    });

    it("ignores boards written by outsiders or without a valid signature", async () => {
        const vault = new Vault();
        await vault.signed(
            "company",
            COMPANY_ONTOLOGY,
            "@dir",
            company(["@dir"]),
        );
        await vault.signed(
            "company",
            COMPANY_ONTOLOGY,
            "@mallory",
            company(["@mallory"]),
        );
        vault.write("company", COMPANY_ONTOLOGY, company(["@mallory"]));
        const board = await resolveBoard("company", ACME, vault, verify);
        expect(board.map((b) => b.directors)).toEqual([["@dir"]]);
    });

    it("never grants a board to a record born without one", async () => {
        const vault = new Vault();
        vault.write("company", COMPANY_ONTOLOGY, {
            id: "acme",
            eName: ACME,
            createdAt: "2026-10-01T00:00:00.000Z",
        });
        await vault.signed(
            "company",
            COMPANY_ONTOLOGY,
            "@mallory",
            company(["@mallory"]),
        );
        expect(await resolveBoard("company", ACME, vault, verify)).toEqual([]);
    });

    it("refuses a first board its signer is not on", async () => {
        const vault = new Vault();
        await vault.signed(
            "company",
            COMPANY_ONTOLOGY,
            "@mallory",
            company(["@dir"]),
        );
        expect(await resolveBoard("company", ACME, vault, verify)).toEqual([]);
    });
});

describe("evaluateFromHistory", () => {
    it("accepts a delegation and a narrowing re-delegation", async () => {
        const vault = await acme();
        await vault.signed(
            "carol",
            DELEGATION_ONTOLOGY,
            "@bob",
            delegation({
                roleId: undefined,
                parentDelegationId: "bob",
                delegateEName: "@carol",
                grantedBy: "@bob",
                scopes: [NDA],
                mayRedelegate: false,
            }),
        );
        expect(await evaluate(vault, "bob")).toMatchObject({
            ok: true,
            delegateEName: "@bob",
        });
        const carol = await evaluate(vault, "carol");
        expect(carol).toMatchObject({
            ok: true,
            delegateEName: "@carol",
            scopes: [NDA],
            chain: ["carol", "bob"],
        });
        expect(
            checkDelegatedSignature(
                {
                    onBehalfOf: ACME,
                    signer: "@carol",
                    scope: NDA,
                    delegationId: "carol",
                    documentHash: "h",
                    session: "s",
                    issuedAt: NOW.toISOString(),
                },
                carol,
            ),
        ).toBeNull();
    });

    it("ignores a delegation granted by a non-director", async () => {
        const vault = await acme();
        await vault.signed(
            "mal",
            DELEGATION_ONTOLOGY,
            "@mallory",
            delegation({ delegateEName: "@mal", grantedBy: "@mallory" }),
        );
        expect(await evaluate(vault, "mal")).toMatchObject({
            ok: false,
            code: "NOT_FOUND",
        });
    });

    it("ignores a re-delegation by someone other than the parent's delegate", async () => {
        const vault = await acme();
        await vault.signed(
            "x",
            DELEGATION_ONTOLOGY,
            "@mallory",
            delegation({
                roleId: undefined,
                parentDelegationId: "bob",
                grantedBy: "@mallory",
                scopes: [NDA],
            }),
        );
        expect(await evaluate(vault, "x")).toMatchObject({
            ok: false,
            code: "NOT_FOUND",
        });
    });

    it("fails a grant copied onto another record", async () => {
        const vault = await acme();
        const [bob] = await vault.versions("bob");
        vault.write("copy", DELEGATION_ONTOLOGY, bob.parsed);
        expect(await evaluate(vault, "copy")).toMatchObject({
            ok: false,
            code: "NOT_FOUND",
        });
    });

    it("ignores an older signed state written back", async () => {
        const vault = await acme();
        const [v1] = await vault.versions("role");
        await vault.signed(
            "role",
            ROLE_ONTOLOGY,
            "@dir",
            role({ scopes: [NDA] }),
        );
        vault.write("role", ROLE_ONTOLOGY, v1.parsed);
        // The narrowed role still holds: Bob is cut down to NDAs.
        expect(await evaluate(vault, "bob")).toMatchObject({
            ok: true,
            scopes: [NDA],
        });
    });

    it("makes a valid revocation final and ignores a forged one", async () => {
        const vault = await acme();
        const [bob] = await vault.versions("bob");
        vault.write(
            "bob",
            DELEGATION_ONTOLOGY,
            revoked(bob.parsed as any, "@mallory"),
        );
        expect(await evaluate(vault, "bob")).toMatchObject({ ok: true });

        await vault.signed(
            "bob",
            DELEGATION_ONTOLOGY,
            "@dir",
            revoked(delegation(), "@dir"),
        );
        await vault.signed(
            "bob",
            DELEGATION_ONTOLOGY,
            "@dir",
            delegation({ updatedAt: "2026-11-01T00:00:00.000Z" }),
        );
        vault.write("bob", DELEGATION_ONTOLOGY, bob.parsed);
        expect(await evaluate(vault, "bob")).toMatchObject({
            ok: false,
            code: "REVOKED",
        });
    });

    it("ignores a revocation signed by the delegate", async () => {
        const vault = await acme();
        await vault.signed(
            "bob",
            DELEGATION_ONTOLOGY,
            "@bob",
            revoked(delegation(), "@bob"),
        );
        expect(await evaluate(vault, "bob")).toMatchObject({ ok: true });
    });

    it("keeps grants made by a director who later left", async () => {
        const vault = await acme();
        await vault.signed(
            "company",
            COMPANY_ONTOLOGY,
            "@dir",
            company(["@dir", "@eve"]),
        );
        await vault.signed(
            "eves",
            DELEGATION_ONTOLOGY,
            "@eve",
            delegation({ delegateEName: "@frank", grantedBy: "@eve" }),
        );
        await vault.signed(
            "company",
            COMPANY_ONTOLOGY,
            "@dir",
            company(["@dir"]),
        );
        expect(await evaluate(vault, "eves")).toMatchObject({
            ok: true,
            delegateEName: "@frank",
        });
        await vault.signed(
            "late",
            DELEGATION_ONTOLOGY,
            "@eve",
            delegation({ delegateEName: "@gus", grantedBy: "@eve" }),
        );
        expect(await evaluate(vault, "late")).toMatchObject({
            ok: false,
            code: "NOT_FOUND",
        });
    });

    it("keeps holders of a role revoked without cascading", async () => {
        const vault = await acme();
        await vault.signed(
            "role",
            ROLE_ONTOLOGY,
            "@dir",
            revoked(role(), "@dir"),
        );
        expect(await evaluate(vault, "bob")).toMatchObject({ ok: true });
    });

    it("drops holders of a role revoked with cascade", async () => {
        const vault = await acme();
        await vault.signed("role", ROLE_ONTOLOGY, "@dir", {
            ...revoked(role(), "@dir"),
            revocationCascade: true,
        });
        expect(await evaluate(vault, "bob")).toMatchObject({
            ok: false,
            code: "REVOKED",
            at: "role",
        });
    });

    it("survives vandalism and deletion of a valid record", async () => {
        const vault = await acme();
        vault.write("bob", DELEGATION_ONTOLOGY, {
            companyEName: ACME,
            junk: true,
        });
        vault.write("bob", DELEGATION_ONTOLOGY, null);
        expect(await evaluate(vault, "bob")).toMatchObject({ ok: true });
    });

    it("rejects immutable fields changing in a later version", async () => {
        const vault = await acme();
        await vault.signed(
            "bob",
            DELEGATION_ONTOLOGY,
            "@dir",
            delegation({ delegateEName: "@mallory" }),
        );
        expect(await evaluate(vault, "bob")).toMatchObject({
            ok: true,
            delegateEName: "@bob",
        });
    });

    it("terminates on a cycle of re-delegations", async () => {
        const vault = await acme();
        await vault.signed(
            "a",
            DELEGATION_ONTOLOGY,
            "@bob",
            delegation({
                roleId: undefined,
                parentDelegationId: "b",
                grantedBy: "@bob",
            }),
        );
        await vault.signed(
            "b",
            DELEGATION_ONTOLOGY,
            "@bob",
            delegation({
                roleId: undefined,
                parentDelegationId: "a",
                grantedBy: "@bob",
            }),
        );
        expect(await evaluate(vault, "a")).toMatchObject({ ok: false });
    });

    it("ignores a postdated version so it cannot block later changes", async () => {
        const vault = await acme();
        await vault.signed(
            "bob",
            DELEGATION_ONTOLOGY,
            "@dir",
            delegation({ title: "Forever" }),
            "9999-01-01T00:00:00.000Z",
        );
        await vault.signed(
            "bob",
            DELEGATION_ONTOLOGY,
            "@dir",
            revoked(delegation(), "@dir"),
        );
        expect(await evaluate(vault, "bob")).toMatchObject({
            ok: false,
            code: "REVOKED",
        });
    });

    it("ignores a revocation written before any valid grant", async () => {
        const vault = await acme();
        await vault.signed(
            "pre",
            DELEGATION_ONTOLOGY,
            "@mallory",
            revoked(delegation({ grantedBy: "@mallory" }), "@mallory"),
        );
        await vault.signed(
            "pre",
            DELEGATION_ONTOLOGY,
            "@dir",
            delegation({ delegateEName: "@hal" }),
        );
        expect(await evaluate(vault, "pre")).toMatchObject({
            ok: true,
            delegateEName: "@hal",
        });
    });

    it("resolves concurrent lookups that share a parent", async () => {
        const vault = await acme();
        for (const id of ["c1", "c2"]) {
            await vault.signed(
                id,
                DELEGATION_ONTOLOGY,
                "@bob",
                delegation({
                    roleId: undefined,
                    parentDelegationId: "bob",
                    delegateEName: `@${id}`,
                    grantedBy: "@bob",
                    scopes: [NDA],
                    mayRedelegate: false,
                }),
            );
        }
        const board = await resolveBoard("company", ACME, vault, verify);
        const src = historyChainSource({
            companyEName: ACME,
            board,
            source: vault,
            verify,
        });
        const results = await Promise.all(
            ["c1", "c2", "bob"].map((id) =>
                evaluateDelegation(id, src, { now: NOW }),
            ),
        );
        expect(results.map((r) => r.ok)).toEqual([true, true, true]);
    });

    it("stops reading history past the depth limit", async () => {
        const vault = await acme();
        let parent = "bob";
        for (let i = 0; i < 40; i++) {
            const id = `deep${i}`;
            await vault.signed(
                id,
                DELEGATION_ONTOLOGY,
                "@bob",
                delegation({
                    roleId: undefined,
                    parentDelegationId: parent,
                    grantedBy: "@bob",
                }),
            );
            parent = id;
        }
        let reads = 0;
        const counting = {
            versions: (id: string) => (reads++, vault.versions(id)),
        };
        const result = await evaluateFromHistory({
            delegationId: parent,
            companyEName: ACME,
            companyId: "company",
            source: counting,
            verify,
            now: NOW,
        });
        expect(result.ok).toBe(false);
        expect(reads).toBeLessThan(25);
    });

    describe("firing", () => {
        /** Bob hands NDAs on to Carol, then Dana fires Bob. */
        async function fired(cascade = false) {
            const vault = await acme();
            await vault.signed(
                "carol",
                DELEGATION_ONTOLOGY,
                "@bob",
                delegation({
                    roleId: undefined,
                    parentDelegationId: "bob",
                    delegateEName: "@carol",
                    grantedBy: "@bob",
                    scopes: [NDA],
                    mayRedelegate: true,
                }),
            );
            await vault.signed("bob", DELEGATION_ONTOLOGY, "@dir", {
                ...revoked(delegation(), "@dir"),
                ...(cascade ? { revocationCascade: true } : {}),
            });
            return vault;
        }

        it("stops Bob but keeps what he granted before", async () => {
            const vault = await fired();
            expect(await evaluate(vault, "bob")).toMatchObject({
                ok: false,
                code: "REVOKED",
                at: "bob",
            });
            expect(await evaluate(vault, "carol")).toMatchObject({
                ok: true,
                chain: ["carol", "bob"],
            });
        });

        it("drops everything Bob handed on when the firing cascades", async () => {
            const vault = await fired(true);
            expect(await evaluate(vault, "carol")).toMatchObject({
                ok: false,
                code: "REVOKED",
                at: "bob",
            });
        });

        it("ignores grants Bob signs after he was fired", async () => {
            const vault = await fired();
            await vault.signed(
                "late",
                DELEGATION_ONTOLOGY,
                "@bob",
                delegation({
                    roleId: undefined,
                    parentDelegationId: "bob",
                    delegateEName: "@eve",
                    grantedBy: "@bob",
                    scopes: [NDA],
                }),
            );
            expect(await evaluate(vault, "late")).toMatchObject({
                ok: false,
                code: "NOT_FOUND",
            });
        });

        it("ignores Bob revoking his grants after he was fired", async () => {
            const vault = await fired();
            const [carol] = await vault.versions("carol");
            await vault.signed(
                "carol",
                DELEGATION_ONTOLOGY,
                "@bob",
                revoked(carol.parsed as any, "@bob"),
            );
            expect(await evaluate(vault, "carol")).toMatchObject({ ok: true });
        });

        it("lets Carol keep handing on below a fired Bob", async () => {
            const vault = await fired();
            await vault.signed(
                "dan",
                DELEGATION_ONTOLOGY,
                "@carol",
                delegation({
                    roleId: undefined,
                    parentDelegationId: "carol",
                    delegateEName: "@dan",
                    grantedBy: "@carol",
                    scopes: [NDA],
                    mayRedelegate: false,
                }),
            );
            expect(await evaluate(vault, "dan")).toMatchObject({
                ok: true,
                chain: ["dan", "carol", "bob"],
            });
        });

        it("never wakes up a grant that was wider than its parent when made", async () => {
            const vault = await acme();
            // Bob is narrowed to NDAs, then grants Carol NDAs and invoices.
            await vault.signed(
                "bob",
                DELEGATION_ONTOLOGY,
                "@dir",
                delegation({
                    scopes: [NDA],
                    updatedAt: "2026-10-05T00:00:00.000Z",
                }),
            );
            await vault.signed(
                "carol",
                DELEGATION_ONTOLOGY,
                "@bob",
                delegation({
                    roleId: undefined,
                    parentDelegationId: "bob",
                    delegateEName: "@carol",
                    grantedBy: "@bob",
                    scopes: [NDA, INVOICE],
                    mayRedelegate: false,
                }),
            );
            // Widening Bob again must not make Carol's old grant valid.
            await vault.signed(
                "bob",
                DELEGATION_ONTOLOGY,
                "@dir",
                delegation({ updatedAt: "2026-10-06T00:00:00.000Z" }),
            );
            expect(await evaluate(vault, "carol")).toMatchObject({
                ok: false,
                code: "NOT_FOUND",
            });
        });

        it("still narrows Carol when the role is narrowed", async () => {
            const vault = await fired();
            await vault.signed(
                "role",
                ROLE_ONTOLOGY,
                "@dir",
                role({
                    scopes: [INVOICE],
                    updatedAt: "2026-11-01T00:00:00.000Z",
                }),
            );
            expect(await evaluate(vault, "carol")).toMatchObject({
                ok: true,
                scopes: [],
            });
        });
    });

    it("finds nothing without a board", async () => {
        const vault = new Vault();
        await vault.signed("role", ROLE_ONTOLOGY, "@dir", role());
        await vault.signed("bob", DELEGATION_ONTOLOGY, "@dir", delegation());
        expect(await evaluate(vault, "bob")).toMatchObject({
            ok: false,
            code: "NOT_FOUND",
        });
    });
});
