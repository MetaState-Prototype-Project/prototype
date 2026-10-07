import { describe, expect, it } from "vitest";
import {
    buildDelegatedSignPayload,
    buildGrantPayload,
    checkGrantAuthorization,
    isReservedPayload,
    parseDelegatedSignPayload,
    PayloadError,
} from "./payloads";
import { ROLE_ONTOLOGY } from "./ontologies";

const fields = {
    onBehalfOf: "@acme",
    signer: "@bob",
    scope: "@esigner:nda",
    delegationId: "d1",
    documentHash: "abc",
    session: "s1",
    issuedAt: "2026-10-07T12:00:00.000Z",
};

describe("delegated sign payload", () => {
    it("round-trips and is reserved", () => {
        const payload = buildDelegatedSignPayload(fields);
        expect(payload.startsWith("w3ds-sign/v1\n")).toBe(true);
        expect(isReservedPayload(payload)).toBe(true);
        expect(parseDelegatedSignPayload(payload)).toEqual(fields);
    });

    it("is the same whatever order the fields come in", () => {
        const reversed = Object.fromEntries(Object.entries(fields).reverse());
        expect(buildDelegatedSignPayload(reversed as typeof fields)).toBe(
            buildDelegatedSignPayload(fields),
        );
    });

    it("refuses core scopes and missing fields", () => {
        expect(() =>
            buildDelegatedSignPayload({ ...fields, scope: "@w3ds:auth" }),
        ).toThrow(PayloadError);
        expect(() =>
            buildDelegatedSignPayload({ ...fields, session: "" }),
        ).toThrow(PayloadError);
    });

    it("rejects non-canonical or tampered strings", () => {
        const payload = buildDelegatedSignPayload(fields);
        const spaced = payload.replace(":", ": ");
        expect(parseDelegatedSignPayload(spaced)).toBeNull();
        expect(
            parseDelegatedSignPayload(payload.replace("}", ',"extra":"x"}')),
        ).toBeNull();
        expect(parseDelegatedSignPayload("a-login-session-uuid")).toBeNull();
        expect(isReservedPayload("a-login-session-uuid")).toBe(false);
    });
});

describe("grant payload", () => {
    it("keeps an own __proto__ key in the hash", async () => {
        const build = (record: Record<string, unknown>) =>
            buildGrantPayload({
                ontology: ROLE_ONTOLOGY,
                companyEName: "@acme",
                signerEName: "@dir",
                record,
            });
        const smuggled = JSON.parse(
            '{"appLimits":{"__proto__":{"maxAmount":1}}}',
        );
        expect(await build(smuggled)).not.toBe(await build({ appLimits: {} }));
    });

    const record = {
        companyEName: "@acme",
        title: "Head of Finance",
        scopes: ["@esigner:nda"],
    };

    it("ignores authorization and key order", async () => {
        const a = await buildGrantPayload({
            ontology: ROLE_ONTOLOGY,
            companyEName: "@acme",
            signerEName: "@dir",
            record,
        });
        const b = await buildGrantPayload({
            ontology: ROLE_ONTOLOGY,
            companyEName: "@acme",
            signerEName: "@dir",
            record: {
                scopes: record.scopes,
                authorization: { x: 1 },
                title: record.title,
                companyEName: "@acme",
            },
        });
        expect(a).toBe(b);
        expect(a.startsWith("w3ds-grant/v1\n")).toBe(true);
    });

    it("checks the authorization against the record", async () => {
        const signedPayload = await buildGrantPayload({
            ontology: ROLE_ONTOLOGY,
            companyEName: "@acme",
            signerEName: "@dir",
            record,
        });
        const authorization = {
            signerEName: "@dir",
            signedPayload,
            signature: "sig",
            signedAt: "2026-10-07T12:00:00.000Z",
        };
        const ok = async (e: string, p: string, s: string) =>
            e === "@dir" && p === signedPayload && s === "sig";

        expect(
            await checkGrantAuthorization(
                ROLE_ONTOLOGY,
                "@acme",
                { ...record, authorization },
                ok,
            ),
        ).toBeNull();
        expect(
            await checkGrantAuthorization(
                ROLE_ONTOLOGY,
                "@acme",
                { ...record, scopes: ["@esigner:invoice"], authorization },
                ok,
            ),
        ).toEqual({ code: "PAYLOAD_MISMATCH" });
        expect(
            await checkGrantAuthorization(
                ROLE_ONTOLOGY,
                "@acme",
                {
                    ...record,
                    authorization: { ...authorization, signature: "forged" },
                },
                ok,
            ),
        ).toEqual({ code: "BAD_SIGNATURE" });
        expect(
            await checkGrantAuthorization(ROLE_ONTOLOGY, "@acme", record, ok),
        ).toEqual({
            code: "MISSING_AUTHORIZATION",
        });
    });
});
