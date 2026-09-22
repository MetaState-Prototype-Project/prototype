import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/static/public", () => ({
    PUBLIC_EID_WALLET_TOKEN: "test-token",
    PUBLIC_REGISTRY_URL: "https://registry.test/",
}));

import {
    acceptSocialBinding,
    cancelSentSocialBinding,
    declineSocialBinding,
    fetchReconciledSocialBindings,
    fetchSocialBindings,
    fetchUnsignedSocialDocs,
    pruneBoundSignerDocs,
} from "./socialBinding";

const ME = "@me";
const BOB = "@bob";

interface Sig {
    signer: string;
    timestamp: string;
}
interface Doc {
    id: string;
    subject: string;
    parties: [string, string];
    relation: string;
    sigs: Sig[];
}

/** eName → the docs that vault holds. */
let vaults: Map<string, Doc[]>;
/** Every id passed to deleteMetaEnvelope, in order. */
let deletes: string[];

function doc(
    id: string,
    subject: string,
    parties: [string, string],
    sigs: Sig[],
    relation = "",
): Doc {
    return { id, subject, parties, relation, sigs };
}

function gql(ename: string): string {
    return `https://vault.test/${ename.slice(1)}/graphql`;
}

function edgeOf(d: Doc) {
    return {
        node: {
            id: d.id,
            parsed: {
                subject: d.subject,
                type: "social_connection",
                data: {
                    kind: "social_connection",
                    name: "Someone",
                    parties: d.parties,
                    relation_description: d.relation,
                },
                signatures: d.sigs.map((s) => ({
                    signer: s.signer,
                    signature: `sig-${s.signer}`,
                    timestamp: s.timestamp,
                })),
            },
        },
    };
}

/**
 * Stands in for the registry plus every eVault: a GET resolves an eName, a POST
 * is answered from the vault the X-ENAME header names.
 */
function vaultHandler() {
    return async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (!init || init.method !== "POST") {
            const ename = decodeURIComponent(
                new URL(url).searchParams.get("w3id") ?? "",
            );
            return jsonResponse({ uri: gql(ename) });
        }

        const ename = (init.headers as Record<string, string>)["X-ENAME"];
        const body = JSON.parse(String(init.body)) as {
            query: string;
            variables?: Record<string, unknown>;
        };
        const docs = vaults.get(ename) ?? [];

        if (body.query.includes("deleteMetaEnvelope")) {
            const id = String(body.variables?.id);
            deletes.push(id);
            vaults.set(
                ename,
                docs.filter((d) => d.id !== id),
            );
            return jsonResponse({ data: { deleteMetaEnvelope: true } });
        }

        if (body.query.includes("createBindingDocumentSignature")) {
            const input = body.variables?.input as {
                bindingDocumentId: string;
                signature: Sig;
            };
            const target = docs.find((d) => d.id === input.bindingDocumentId);
            target?.sigs.push({
                signer: input.signature.signer,
                timestamp: input.signature.timestamp,
            });
            return jsonResponse({
                data: {
                    createBindingDocumentSignature: {
                        bindingDocument: {},
                        errors: [],
                    },
                },
            });
        }

        return jsonResponse({
            data: {
                bindingDocuments: {
                    edges: docs.map(edgeOf),
                    pageInfo: { hasNextPage: false, endCursor: null },
                },
            },
        });
    };
}

function jsonResponse(payload: unknown) {
    return { ok: true, json: async () => payload } as Response;
}

beforeEach(() => {
    vaults = new Map();
    deletes = [];
    vi.stubGlobal("fetch", vi.fn(vaultHandler()));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("leftovers from an already-bound signer", () => {
    // D1 is a completed binding accepted at t20; D2 predates that acceptance,
    // D3 was sent after it.
    beforeEach(() => {
        vaults.set(ME, [
            doc(
                "D1",
                ME,
                [BOB, ME],
                [
                    { signer: BOB, timestamp: "t10" },
                    { signer: ME, timestamp: "t20" },
                ],
            ),
            doc("D2", ME, [BOB, ME], [{ signer: BOB, timestamp: "t15" }]),
            doc("D3", ME, [BOB, ME], [{ signer: BOB, timestamp: "t30" }]),
        ]);
    });

    it("surfaces a request sent after the earlier binding was accepted", async () => {
        const unsigned = await fetchUnsignedSocialDocs(gql(ME), ME);
        expect(unsigned.map((e) => e.node.id)).toEqual(["D3"]);
    });

    it("prunes only the envelope that predates acceptance", async () => {
        await expect(pruneBoundSignerDocs(gql(ME), ME)).resolves.toBe(1);
        expect(deletes).toEqual(["D2"]);
    });
});

describe("acting on one request of several", () => {
    beforeEach(() => {
        vaults.set(ME, [
            doc(
                "P1",
                ME,
                [BOB, ME],
                [{ signer: BOB, timestamp: "t1" }],
                "coffee",
            ),
            doc(
                "P2",
                ME,
                [BOB, ME],
                [{ signer: BOB, timestamp: "t2" }],
                "coffee",
            ),
            doc(
                "P3",
                ME,
                [BOB, ME],
                [{ signer: BOB, timestamp: "t3" }],
                "work",
            ),
        ]);
    });

    it("accepting signs the doc and drops only its repeat-scan duplicate", async () => {
        const parsed = edgeOf((vaults.get(ME) as Doc[])[0]).node.parsed;
        await acceptSocialBinding(gql(ME), ME, "P1", parsed, async () => "sig");

        expect(deletes).toEqual(["P2"]);
        const remaining = vaults.get(ME) as Doc[];
        expect(remaining.map((d) => d.id)).toEqual(["P1", "P3"]);
        expect(remaining[0].sigs.map((s) => s.signer)).toEqual([BOB, ME]);
    });

    it("declining removes the request and its duplicate, not the other invite", async () => {
        const parsed = edgeOf((vaults.get(ME) as Doc[])[0]).node.parsed;
        await declineSocialBinding(gql(ME), ME, "P1", parsed);

        expect(deletes).toEqual(["P1", "P2"]);
        expect((vaults.get(ME) as Doc[]).map((d) => d.id)).toEqual(["P3"]);
    });
});

describe("reconciling sent mirrors", () => {
    it("keeps a second invite pending when an earlier one with the same contact is confirmed", async () => {
        vaults.set(ME, [
            doc(
                "M1",
                ME,
                [ME, BOB],
                [{ signer: ME, timestamp: "t1" }],
                "coffee",
            ),
            doc("M2", ME, [ME, BOB], [{ signer: ME, timestamp: "t2" }], "work"),
        ]);
        vaults.set(BOB, [
            doc(
                "R1",
                BOB,
                [ME, BOB],
                [
                    { signer: ME, timestamp: "t1" },
                    { signer: BOB, timestamp: "t5" },
                ],
                "coffee",
            ),
            doc(
                "R2",
                BOB,
                [ME, BOB],
                [{ signer: ME, timestamp: "t2" }],
                "work",
            ),
        ]);

        const out = await fetchReconciledSocialBindings(gql(ME), ME);
        expect(
            Object.fromEntries(out.map((s) => [s.docId, s.mutuallySigned])),
        ).toEqual({ M1: true, M2: false });
        expect(deletes).toEqual([]);
    });

    it("drops a mirror the counterparty declined, ignoring their own mirror", async () => {
        vaults.set(ME, [
            doc("M1", ME, [ME, BOB], [{ signer: ME, timestamp: "t1" }], "x"),
        ]);
        // Bob's own mirror: same parties and subject=@bob, but he originated it,
        // so it says nothing about the invite we sent.
        vaults.set(BOB, [
            doc("B1", BOB, [BOB, ME], [{ signer: BOB, timestamp: "t9" }], "x"),
        ]);

        const out = await fetchReconciledSocialBindings(gql(ME), ME);
        expect(out).toEqual([]);
        expect(deletes).toEqual(["M1"]);
    });

    it("keeps everything when the counterparty vault can't be reached", async () => {
        vaults.set(ME, [
            doc("M1", ME, [ME, BOB], [{ signer: ME, timestamp: "t1" }], "x"),
        ]);
        const handler = vaultHandler();
        vi.stubGlobal(
            "fetch",
            vi.fn(async (input: string, init?: RequestInit) => {
                const ename = (init?.headers as Record<string, string>)?.[
                    "X-ENAME"
                ];
                if (ename === BOB) throw new Error("offline");
                return handler(input, init);
            }),
        );

        const out = await fetchReconciledSocialBindings(gql(ME), ME);
        expect(out.map((s) => s.docId)).toEqual(["M1"]);
        expect(deletes).toEqual([]);
    });
});

describe("cancelling a sent invite", () => {
    it("deletes the pending doc over there, then the local mirror", async () => {
        vaults.set(ME, [
            doc("M1", ME, [ME, BOB], [{ signer: ME, timestamp: "t1" }], "x"),
        ]);
        vaults.set(BOB, [
            doc("R1", BOB, [ME, BOB], [{ signer: ME, timestamp: "t1" }], "x"),
        ]);

        await cancelSentSocialBinding(gql(ME), ME, "M1", BOB, "x");

        expect(deletes).toEqual(["R1", "M1"]);
    });

    it("refuses to withdraw a request the counterparty already confirmed", async () => {
        vaults.set(ME, [
            doc("M1", ME, [ME, BOB], [{ signer: ME, timestamp: "t1" }], "x"),
        ]);
        vaults.set(BOB, [
            doc(
                "R1",
                BOB,
                [ME, BOB],
                [
                    { signer: ME, timestamp: "t1" },
                    { signer: BOB, timestamp: "t5" },
                ],
                "x",
            ),
        ]);

        await expect(
            cancelSentSocialBinding(gql(ME), ME, "M1", BOB, "x"),
        ).rejects.toThrow(/just confirmed/);
        expect(deletes).toEqual([]);
    });
});

describe("fetchSocialBindings", () => {
    it("carries the parsed doc so a pending request can be signed from the list", async () => {
        vaults.set(ME, [
            doc("P1", ME, [BOB, ME], [{ signer: BOB, timestamp: "t1" }], "hi"),
        ]);

        const [summary] = await fetchSocialBindings(gql(ME), ME);
        expect(summary.role).toBe("received");
        expect(summary.mutuallySigned).toBe(false);
        expect(summary.parsed.subject).toBe(ME);
        expect(summary.parsed.data.relation_description).toBe("hi");
    });
});
