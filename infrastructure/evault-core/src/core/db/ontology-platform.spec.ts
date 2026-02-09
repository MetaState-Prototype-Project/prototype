import { describe, it, expect } from "vitest";
import { inferPlatformFromOntology } from "./ontology-platform";

describe("inferPlatformFromOntology (backfill only)", () => {
    it("should return blabsy for social ontologies (user, message, group)", () => {
        expect(
            inferPlatformFromOntology(
                "550e8400-e29b-41d4-a716-446655440000",
            ),
        ).toBe("blabsy");
        expect(
            inferPlatformFromOntology(
                "550e8400-e29b-41d4-a716-446655440004",
            ),
        ).toBe("blabsy");
        expect(
            inferPlatformFromOntology(
                "550e8400-e29b-41d4-a716-446655440003",
            ),
        ).toBe("blabsy");
    });

    it("should return eCurrency for ledger/currency ontologies", () => {
        expect(
            inferPlatformFromOntology(
                "550e8400-e29b-41d4-a716-446655440006",
            ),
        ).toBe("eCurrency");
        expect(
            inferPlatformFromOntology(
                "550e8400-e29b-41d4-a716-446655440008",
            ),
        ).toBe("eCurrency");
    });

    it("should return unknown for unmapped ontology", () => {
        expect(inferPlatformFromOntology("random-ontology-id")).toBe(
            "unknown",
        );
        expect(inferPlatformFromOntology("")).toBe("unknown");
    });
});
