import { describe, expect, it } from "vitest";
import { DELEGATION_ONTOLOGY, USER_PROFILE_ONTOLOGY } from "./ontologies";
import {
    checkScopes,
    isCoreScope,
    isScopeSubset,
    normaliseScope,
    parseScope,
} from "./scopes";

const INVOICE = "ontology:11111111-2222-4333-8444-555555555555";

describe("scopes", () => {
    it("parses ontology and platform scopes", () => {
        expect(parseScope(INVOICE)).toEqual({
            kind: "ontology",
            ontology: "11111111-2222-4333-8444-555555555555",
        });
        expect(parseScope("@esigner:nda")).toEqual({
            kind: "platform",
            platform: "@esigner",
            keyword: "nda",
        });
        for (const bad of [
            "nda",
            "ontology:xyz",
            "@esigner:",
            "esigner:nda",
            42,
        ]) {
            expect(parseScope(bad)).toBeNull();
        }
    });

    it("normalises ontology ids to lowercase", () => {
        expect(
            normaliseScope(
                INVOICE.toUpperCase().replace("ONTOLOGY", "ontology"),
            ),
        ).toBe(INVOICE);
    });

    it("treats identity, authority and protocol scopes as core", () => {
        expect(isCoreScope(`ontology:${DELEGATION_ONTOLOGY}`)).toBe(true);
        expect(isCoreScope(`ontology:${USER_PROFILE_ONTOLOGY}`)).toBe(true);
        expect(isCoreScope("@w3ds:auth")).toBe(true);
        expect(isCoreScope("@W3DS:keys")).toBe(true);
        expect(isCoreScope(INVOICE)).toBe(false);
        expect(isCoreScope("@esigner:nda")).toBe(false);
    });

    it("rejects empty, invalid and core scope lists", () => {
        expect(checkScopes([])).toEqual({ code: "EMPTY" });
        expect(checkScopes(["nope"])).toEqual({
            code: "INVALID_SCOPE",
            scope: "nope",
        });
        expect(checkScopes([INVOICE, "@w3ds:auth"])).toEqual({
            code: "CORE_SCOPE",
            scope: "@w3ds:auth",
        });
        expect(checkScopes([INVOICE, "@esigner:nda"])).toBeNull();
    });

    it("checks subsets", () => {
        expect(isScopeSubset(["@esigner:nda"], [INVOICE, "@esigner:nda"])).toBe(
            true,
        );
        expect(isScopeSubset([INVOICE], ["@esigner:nda"])).toBe(false);
        expect(isScopeSubset(["bad"], ["bad"])).toBe(false);
    });
});
