import { createHash } from "node:crypto";
import {
    buildGrantPayload,
    COMPANY_ONTOLOGY,
    DELEGATION_ONTOLOGY,
    ROLE_ONTOLOGY,
    SHAREHOLDING_ONTOLOGY,
} from "@metastate-foundation/delegation";
import type { Driver } from "neo4j-driver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    setupTestNeo4j,
    teardownTestNeo4j,
} from "../../test-utils/neo4j-setup";
import { DbService } from "../db/db.service";
import { createDelegationGrantConstraint } from "../db/migrations/add-delegation-grant-constraint";
import { DelegationWriteGuard } from "./delegation-write-guard";

const NDA = "@esigner:nda";
const INVOICE = "ontology:11111111-2222-4333-8444-555555555555";
const T = "2026-10-08T12:00:00.000Z";

/** A stand-in signature: only `sign` produces one `verify` accepts. */
const fakeSig = (eName: string, payload: string) =>
    `sig:${eName}:${createHash("sha256").update(payload).digest("hex")}`;
const verify = async (eName: string, payload: string, signature: string) =>
    signature === fakeSig(eName, payload);

describe("DelegationWriteGuard", () => {
    let driver: Driver;
    let db: DbService;
    let guard: DelegationWriteGuard;

    beforeAll(async () => {
        const setup = await setupTestNeo4j();
        driver = setup.driver;
        db = new DbService(driver);
        guard = new DelegationWriteGuard(db, verify);
        await createDelegationGrantConstraint(driver);
    }, 120000);

    afterAll(async () => {
        await teardownTestNeo4j();
    });

    /** Signs a record as `signer` for the company `vault`. */
    async function sign(
        vault: string,
        ontology: string,
        signer: string,
        record: Record<string, unknown>,
    ) {
        const { authorization: _drop, ...rest } = record;
        const signedPayload = await buildGrantPayload({
            ontology,
            companyEName: vault,
            signerEName: signer,
            record: rest,
        });
        return {
            ...rest,
            authorization: {
                signerEName: signer,
                signedPayload,
                signature: fakeSig(signer, signedPayload),
                signedAt: T,
            },
        };
    }

    /** Writes like the GraphQL resolvers do: guard, write, then after-write. */
    async function write(
        vault: string,
        ontology: string,
        payload: Record<string, any>,
        id?: string,
    ): Promise<string> {
        const ticket = await guard.beforeWrite(vault, {
            ontology,
            payload,
            id,
        });
        let landed: string;
        try {
            landed = id
                ? (
                      await db.updateMetaEnvelopeById(
                          id,
                          { ontology, payload, acl: ["*"] },
                          ["*"],
                          vault,
                      )
                  ).metaEnvelope.id
                : (
                      await db.storeMetaEnvelope(
                          { ontology, payload, acl: ["*"] },
                          ["*"],
                          vault,
                      )
                  ).metaEnvelope.id;
        } catch (error) {
            await guard.abortWrite(ticket);
            throw error;
        }
        await guard.afterWrite(vault, ticket, landed);
        return landed;
    }

    const parsed = async (vault: string, id: string) =>
        (await db.findMetaEnvelopeById(id, vault))?.parsed as Record<
            string,
            any
        >;

    const company = (vault: string, directors: string[]) => ({
        id: vault,
        eName: vault,
        directors,
        createdAt: T,
        updatedAt: T,
    });

    const role = (vault: string, over: Record<string, unknown> = {}) => ({
        companyEName: vault,
        title: "Head of Finance",
        scopes: [NDA, INVOICE],
        mayRedelegate: true,
        status: "active",
        createdBy: "@dir",
        createdAt: T,
        updatedAt: T,
        ...over,
    });

    const delegation = (vault: string, over: Record<string, unknown> = {}) => ({
        companyEName: vault,
        delegateEName: "@bob",
        title: "Head of Finance",
        scopes: [NDA, INVOICE],
        mayRedelegate: true,
        grantedBy: "@dir",
        status: "active",
        createdAt: T,
        updatedAt: T,
        ...over,
    });

    /** A company with one director (@dir), one role and Bob holding it. */
    async function setUp(vault: string) {
        const companyId = await write(
            vault,
            COMPANY_ONTOLOGY,
            await sign(
                vault,
                COMPANY_ONTOLOGY,
                "@dir",
                company(vault, ["@dir"]),
            ),
        );
        const roleId = await write(
            vault,
            ROLE_ONTOLOGY,
            await sign(vault, ROLE_ONTOLOGY, "@dir", role(vault)),
        );
        const bobId = await write(
            vault,
            DELEGATION_ONTOLOGY,
            await sign(
                vault,
                DELEGATION_ONTOLOGY,
                "@dir",
                delegation(vault, { roleId }),
            ),
        );
        return { companyId, roleId, bobId };
    }

    const rejects = (promise: Promise<unknown>, code: string) =>
        expect(promise).rejects.toMatchObject({ code });

    describe("company", () => {
        it("lets the creator set the first board", async () => {
            const { companyId } = await setUp("@co-create");
            expect((await parsed("@co-create", companyId)).directors).toEqual([
                "@dir",
            ]);
        });

        it("refuses unsigned, wrongly signed and outsider-signed boards", async () => {
            const vault = "@co-bad";
            await rejects(
                write(vault, COMPANY_ONTOLOGY, company(vault, ["@dir"])),
                "UNSIGNED",
            );
            const signed = await sign(
                vault,
                COMPANY_ONTOLOGY,
                "@dir",
                company(vault, ["@dir"]),
            );
            await rejects(
                write(vault, COMPANY_ONTOLOGY, {
                    ...signed,
                    directors: ["@mallory"],
                }),
                "BAD_AUTHORIZATION",
            );
            await rejects(
                write(
                    vault,
                    COMPANY_ONTOLOGY,
                    await sign(
                        vault,
                        COMPANY_ONTOLOGY,
                        "@mallory",
                        company(vault, ["@dir"]),
                    ),
                ),
                "NOT_AUTHORIZED",
            );
        });

        it("allows one board per vault, changed only by an existing director", async () => {
            const vault = "@co-board";
            const { companyId } = await setUp(vault);
            await rejects(
                write(
                    vault,
                    COMPANY_ONTOLOGY,
                    await sign(
                        vault,
                        COMPANY_ONTOLOGY,
                        "@eve",
                        company(vault, ["@eve"]),
                    ),
                ),
                "COMPANY_EXISTS",
            );
            await rejects(
                write(
                    vault,
                    COMPANY_ONTOLOGY,
                    await sign(vault, COMPANY_ONTOLOGY, "@eve", {
                        ...company(vault, ["@dir", "@eve"]),
                        updatedAt: "2026-10-09T00:00:00.000Z",
                    }),
                    companyId,
                ),
                "NOT_AUTHORIZED",
            );
            await write(
                vault,
                COMPANY_ONTOLOGY,
                await sign(vault, COMPANY_ONTOLOGY, "@dir", {
                    ...company(vault, ["@dir", "@eve"]),
                    updatedAt: "2026-10-09T00:00:00.000Z",
                }),
                companyId,
            );
            expect((await parsed(vault, companyId)).directors).toEqual([
                "@dir",
                "@eve",
            ]);
        });
    });

    describe("roles and delegations", () => {
        it("needs a company and a director", async () => {
            await rejects(
                write(
                    "@no-co",
                    ROLE_ONTOLOGY,
                    await sign("@no-co", ROLE_ONTOLOGY, "@dir", role("@no-co")),
                ),
                "NO_COMPANY",
            );
            const vault = "@rd-director";
            await setUp(vault);
            await rejects(
                write(
                    vault,
                    ROLE_ONTOLOGY,
                    await sign(
                        vault,
                        ROLE_ONTOLOGY,
                        "@bob",
                        role(vault, { createdBy: "@bob" }),
                    ),
                ),
                "NOT_AUTHORIZED",
            );
        });

        it("refuses core scopes and wider-than-role delegations", async () => {
            const vault = "@rd-scopes";
            const { roleId } = await setUp(vault);
            await rejects(
                write(
                    vault,
                    ROLE_ONTOLOGY,
                    await sign(
                        vault,
                        ROLE_ONTOLOGY,
                        "@dir",
                        role(vault, { scopes: ["@w3ds:auth"] }),
                    ),
                ),
                "INVALID_RECORD",
            );
            await rejects(
                write(
                    vault,
                    DELEGATION_ONTOLOGY,
                    await sign(
                        vault,
                        DELEGATION_ONTOLOGY,
                        "@dir",
                        delegation(vault, {
                            roleId,
                            scopes: ["@esigner:invoice"],
                        }),
                    ),
                ),
                "INVALID_RECORD",
            );
        });

        it("lets a delegate re-delegate a narrower part, and nobody else", async () => {
            const vault = "@rd-redelegate";
            const { bobId } = await setUp(vault);
            const carol = delegation(vault, {
                parentDelegationId: bobId,
                delegateEName: "@carol",
                grantedBy: "@bob",
                scopes: [NDA],
                mayRedelegate: false,
            });
            await write(
                vault,
                DELEGATION_ONTOLOGY,
                await sign(vault, DELEGATION_ONTOLOGY, "@bob", carol),
            );
            await rejects(
                write(
                    vault,
                    DELEGATION_ONTOLOGY,
                    await sign(vault, DELEGATION_ONTOLOGY, "@mallory", {
                        ...carol,
                        grantedBy: "@mallory",
                    }),
                ),
                "NOT_AUTHORIZED",
            );
        });
    });

    describe("single-use grants", () => {
        it("refuses an authorization copied onto another record", async () => {
            const vault = "@grant-copy";
            const { roleId } = await setUp(vault);
            const signed = await sign(
                vault,
                DELEGATION_ONTOLOGY,
                "@dir",
                delegation(vault, { roleId, delegateEName: "@dan" }),
            );
            await write(vault, DELEGATION_ONTOLOGY, signed);
            await rejects(
                write(vault, DELEGATION_ONTOLOGY, signed),
                "REPLAYED_GRANT",
            );
        });

        it("refuses writing back an older signed state", async () => {
            const vault = "@grant-rollback";
            await setUp(vault);
            const v1 = await sign(
                vault,
                ROLE_ONTOLOGY,
                "@dir",
                role(vault, { title: "Signer" }),
            );
            const id = await write(vault, ROLE_ONTOLOGY, v1);
            const v2 = await sign(vault, ROLE_ONTOLOGY, "@dir", {
                ...role(vault, { title: "Signer" }),
                scopes: [NDA],
                updatedAt: "2026-10-09T00:00:00.000Z",
            });
            await write(vault, ROLE_ONTOLOGY, v2, id);
            await rejects(
                write(vault, ROLE_ONTOLOGY, v1, id),
                "REPLAYED_GRANT",
            );
        });

        it("lets an identical re-send through", async () => {
            const vault = "@grant-resend";
            const { roleId } = await setUp(vault);
            const current = await parsed(vault, roleId);
            await expect(
                write(vault, ROLE_ONTOLOGY, current, roleId),
            ).resolves.toBe(roleId);
        });

        it("frees the grant when the write fails", async () => {
            const vault = "@grant-abort";
            const { roleId } = await setUp(vault);
            const signed = await sign(
                vault,
                DELEGATION_ONTOLOGY,
                "@dir",
                delegation(vault, { roleId, delegateEName: "@fay" }),
            );
            const ticket = await guard.beforeWrite(vault, {
                ontology: DELEGATION_ONTOLOGY,
                payload: signed,
            });
            await guard.abortWrite(ticket);
            await expect(
                write(vault, DELEGATION_ONTOLOGY, signed),
            ).resolves.toBeTruthy();
        });
    });

    describe("revocation", () => {
        it("lets the grantor or a director revoke, and nobody else", async () => {
            const vault = "@revoke-who";
            const { bobId } = await setUp(vault);
            const current = await parsed(vault, bobId);
            const revoked = (by: string) => ({
                ...current,
                status: "revoked",
                revokedAt: T,
                revokedBy: by,
                revocationReason: "revoked",
            });
            await rejects(
                write(
                    vault,
                    DELEGATION_ONTOLOGY,
                    await sign(
                        vault,
                        DELEGATION_ONTOLOGY,
                        "@bob",
                        revoked("@bob"),
                    ),
                    bobId,
                ),
                "NOT_AUTHORIZED",
            );
            await write(
                vault,
                DELEGATION_ONTOLOGY,
                await sign(vault, DELEGATION_ONTOLOGY, "@dir", revoked("@dir")),
                bobId,
            );
            expect((await parsed(vault, bobId)).status).toBe("revoked");
        });

        it("makes revocation final", async () => {
            const vault = "@revoke-final";
            const { bobId } = await setUp(vault);
            const current = await parsed(vault, bobId);
            const revoked = {
                ...current,
                status: "revoked",
                revokedAt: T,
                revokedBy: "@dir",
                revocationReason: "revoked",
            };
            await write(
                vault,
                DELEGATION_ONTOLOGY,
                await sign(vault, DELEGATION_ONTOLOGY, "@dir", revoked),
                bobId,
            );
            await rejects(
                write(
                    vault,
                    DELEGATION_ONTOLOGY,
                    await sign(vault, DELEGATION_ONTOLOGY, "@dir", {
                        ...current,
                        updatedAt: "2026-10-10T00:00:00.000Z",
                    }),
                    bobId,
                ),
                "IMMUTABLE",
            );
        });

        it("cascades a revoked role down the whole chain", async () => {
            const vault = "@cascade-role";
            const { roleId, bobId } = await setUp(vault);
            const carolId = await write(
                vault,
                DELEGATION_ONTOLOGY,
                await sign(
                    vault,
                    DELEGATION_ONTOLOGY,
                    "@bob",
                    delegation(vault, {
                        parentDelegationId: bobId,
                        delegateEName: "@carol",
                        grantedBy: "@bob",
                        scopes: [NDA],
                        mayRedelegate: false,
                    }),
                ),
            );
            const current = await parsed(vault, roleId);
            await write(
                vault,
                ROLE_ONTOLOGY,
                await sign(vault, ROLE_ONTOLOGY, "@dir", {
                    ...current,
                    status: "revoked",
                    revokedAt: T,
                    revokedBy: "@dir",
                }),
                roleId,
            );
            for (const id of [bobId, carolId]) {
                expect(await parsed(vault, id)).toMatchObject({
                    status: "revoked",
                    revocationReason: "cascade",
                    revokedBy: "@dir",
                });
            }
        });

        it("cascades narrowing only to what it no longer covers", async () => {
            const vault = "@cascade-narrow";
            const { roleId, bobId } = await setUp(vault);
            const ndaOnly = await write(
                vault,
                DELEGATION_ONTOLOGY,
                await sign(
                    vault,
                    DELEGATION_ONTOLOGY,
                    "@dir",
                    delegation(vault, {
                        roleId,
                        delegateEName: "@gus",
                        scopes: [NDA],
                    }),
                ),
            );
            const current = await parsed(vault, roleId);
            await write(
                vault,
                ROLE_ONTOLOGY,
                await sign(vault, ROLE_ONTOLOGY, "@dir", {
                    ...current,
                    scopes: [NDA],
                    updatedAt: "2026-10-09T00:00:00.000Z",
                }),
                roleId,
            );
            expect((await parsed(vault, bobId)).status).toBe("revoked");
            expect((await parsed(vault, ndaOnly)).status).toBe("active");
        });
    });

    describe("other writes", () => {
        it("refuses deleting a governed record", async () => {
            const vault = "@other-delete";
            const { bobId } = await setUp(vault);
            await rejects(
                guard.assertNotGoverned(vault, bobId, "Deleting"),
                "IMMUTABLE",
            );
        });

        it("ignores copies naming another company and unrelated ontologies", async () => {
            const vault = "@other-copy";
            await expect(
                write(
                    vault,
                    DELEGATION_ONTOLOGY,
                    delegation("@someone-else", { roleId: "r" }),
                ),
            ).resolves.toBeTruthy();
            await expect(
                write(vault, SHAREHOLDING_ONTOLOGY, {
                    companyEName: "@someone-else",
                }),
            ).resolves.toBeTruthy();
        });
    });
});
