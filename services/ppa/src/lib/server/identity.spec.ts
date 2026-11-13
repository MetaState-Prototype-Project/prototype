import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The eVault read is the only I/O; everything else is pure classification.
 * Stubbed with a plain closure rather than vi.fn(): a mock records the result
 * of every call, and a recorded throw is surfaced as a test failure even when
 * the code under test catches it.
 */
let impl: (ename: string) => unknown = () => [];
let calls: string[] = [];

vi.mock("./evault", () => ({
    fetchBindingDocuments: (ename: string) => {
        calls.push(ename);
        return impl(ename);
    },
}));

const { deriveIdentity, minimumIdentity, accountableActors } = await import(
    "./identity"
);

const idDoc = (subject: string) => ({
    id: `id-${subject}`,
    subject,
    type: "id_document",
    data: { vendor: "veriff", reference: "abc", name: "A Person" },
    signatures: [
        { signer: subject, signature: "s", timestamp: "2026-01-01T00:00:00Z" },
    ],
});

const connection = (a: string, b: string) => ({
    id: `sc-${a}-${b}`,
    subject: a,
    type: "social_connection",
    data: { name: "A Person", parties: [a, b], relation_description: "colleague" },
    signatures: [
        { signer: a, signature: "s1", timestamp: "2026-01-01T00:00:00Z" },
        { signer: b, signature: "s2", timestamp: "2026-01-01T00:00:00Z" },
    ],
});

describe("deriveIdentity", () => {
    beforeEach(() => {
        impl = () => [];
        calls = [];
    });

    it("is IAL1 with no evidence", async () => {
        expect((await deriveIdentity("@nobody")).ial).toBe("IAL1");
    });

    it("is IAL2 when attested by someone, without an eID", async () => {
        impl = (e) => (e === "@a" ? [connection("@a", "@b")] : []);
        const result = await deriveIdentity("@a");
        expect(result.ial).toBe("IAL2");
        expect(result.attestations).toBe(1);
    });

    it("is IAL3 with a verified eID", async () => {
        impl = (e) => (e === "@a" ? [idDoc("@a")] : []);
        expect((await deriveIdentity("@a")).ial).toBe("IAL3");
    });

    it("needs three passport-identified attesters for IAL4", async () => {
        const attesters = ["@x", "@y", "@z"];
        impl = (e) => {
            if (e === "@a") {
                return [idDoc("@a"), ...attesters.map((p) => connection("@a", p))];
            }
            return attesters.includes(e) ? [idDoc(e)] : [];
        };
        const result = await deriveIdentity("@a");
        expect(result.ial).toBe("IAL4");
        expect(result.verifiedAttesters).toBe(3);
    });

    it("does not reach IAL4 when the attesters are themselves unverified", async () => {
        impl = (e) =>
            e === "@a"
                ? [
                      idDoc("@a"),
                      connection("@a", "@x"),
                      connection("@a", "@y"),
                      connection("@a", "@z"),
                  ]
                : [];
        const result = await deriveIdentity("@a");
        expect(result.ial).toBe("IAL3");
        expect(result.verifiedAttesters).toBe(0);
    });

    it("ignores a social connection only one party signed", async () => {
        const half = {
            ...connection("@a", "@b"),
            signatures: [{ signer: "@a", signature: "s", timestamp: "t" }],
        };
        impl = (e) => (e === "@a" ? [half] : []);
        expect((await deriveIdentity("@a")).ial).toBe("IAL1");
    });

    it("terminates on a mutual attestation", async () => {
        impl = (e) => {
            if (e === "@a") return [idDoc("@a"), connection("@a", "@b")];
            if (e === "@b") return [idDoc("@b"), connection("@b", "@a")];
            return [];
        };
        const result = await deriveIdentity("@a");
        expect(result.ial).toBe("IAL3");
        // @a, then @b one level deep — and no further.
        expect(calls).toEqual(["@a", "@b"]);
    });

    it("stays IAL1 and reports why when the vault cannot be read", async () => {
        impl = () => {
            throw new Error("resolve failed");
        };
        const result = await deriveIdentity("@a");
        expect(result.ial).toBe("IAL1");
        expect(result.error).toContain("resolve failed");
    });
});

describe("minimumIdentity", () => {
    it("takes the weakest actor", () => {
        expect(
            minimumIdentity([
                {
                    ename: "@a",
                    ial: "IAL4",
                    idDocuments: 1,
                    attestations: 3,
                    verifiedAttesters: 3,
                },
                {
                    ename: "@b",
                    ial: "IAL2",
                    idDocuments: 0,
                    attestations: 1,
                    verifiedAttesters: 0,
                },
            ]),
        ).toBe("IAL2");
    });

    it("is IAL1 when there are no actors at all", () => {
        expect(minimumIdentity([])).toBe("IAL1");
    });
});

describe("accountableActors", () => {
    it("includes the release signer and de-duplicates", () => {
        expect(
            accountableActors({
                authorEnames: ["@a", "@signer", "@a"],
                submissionProof: { statement: { signerEName: "@signer" } },
            }),
        ).toEqual([
            { ename: "@signer", role: "releaseSigner" },
            { ename: "@a", role: "author" },
        ]);
    });
});
