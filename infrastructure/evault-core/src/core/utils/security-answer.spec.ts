import { describe, expect, it } from "vitest";
import {
    hashAnswer,
    normalizeAnswer,
    verifyAnswer,
} from "./security-answer";

describe("normalizeAnswer", () => {
    it("trims leading and trailing whitespace", () => {
        expect(normalizeAnswer("   bob   ")).toBe("bob");
    });

    it("collapses internal whitespace", () => {
        expect(normalizeAnswer("bob    smith")).toBe("bob smith");
        expect(normalizeAnswer("bob\t\nsmith")).toBe("bob smith");
    });

    it("lowercases", () => {
        expect(normalizeAnswer("BOB")).toBe("bob");
        expect(normalizeAnswer("Bob Smith")).toBe("bob smith");
    });

    it("strips punctuation but keeps letters, numbers, and single spaces", () => {
        expect(normalizeAnswer("Bob's, smith!")).toBe("bobs smith");
        expect(normalizeAnswer("answer: 42")).toBe("answer 42");
        expect(normalizeAnswer("(no?) parens.")).toBe("no parens");
    });

    it("preserves Unicode letters (accents, non-Latin scripts)", () => {
        expect(normalizeAnswer("Café")).toBe("café");
        expect(normalizeAnswer("北京")).toBe("北京");
        expect(normalizeAnswer("Ñame")).toBe("ñame");
    });

    it("treats different but visually identical forms identically (NFKC)", () => {
        // U+00E9 (é) vs U+0065 U+0301 (e + combining acute)
        const precomposed = "café";
        const decomposed = "café";
        expect(normalizeAnswer(precomposed)).toBe(normalizeAnswer(decomposed));
    });

    it("returns '' for non-string input", () => {
        // Pretend the caller violated the type contract.
        // biome-ignore lint/suspicious/noExplicitAny: forcing a wrong-type input
        expect(normalizeAnswer(null as any)).toBe("");
        // biome-ignore lint/suspicious/noExplicitAny: forcing a wrong-type input
        expect(normalizeAnswer(undefined as any)).toBe("");
    });

    it("returns '' when input is only punctuation/whitespace", () => {
        expect(normalizeAnswer("   ")).toBe("");
        expect(normalizeAnswer("!!!")).toBe("");
        expect(normalizeAnswer("  .,.,  ")).toBe("");
    });
});

describe("hashAnswer / verifyAnswer round-trip", () => {
    // argon2 is intentionally slow; allow generous timeouts on these.
    it("a normalised answer verifies against its own hash", async () => {
        const hash = await hashAnswer("My Mother's Maiden Name!");
        expect(await verifyAnswer(hash, "My Mother's Maiden Name!")).toBe(true);
    }, 10_000);

    it(
        "verification ignores casing, punctuation, and whitespace differences",
        async () => {
            const hash = await hashAnswer("First Kiss: 19990422");
            expect(await verifyAnswer(hash, "first kiss 19990422")).toBe(true);
            expect(await verifyAnswer(hash, "  FIRST!! KISS  19990422  ")).toBe(
                true,
            );
        },
        10_000,
    );

    it(
        "rejects a wrong answer",
        async () => {
            const hash = await hashAnswer("correct answer");
            expect(await verifyAnswer(hash, "wrong answer")).toBe(false);
        },
        10_000,
    );

    it(
        "rejects an answer that normalises to empty",
        async () => {
            const hash = await hashAnswer("anything");
            expect(await verifyAnswer(hash, "   ")).toBe(false);
            expect(await verifyAnswer(hash, "!!!")).toBe(false);
        },
        10_000,
    );

    it("refuses to hash an answer that normalises to empty", async () => {
        await expect(hashAnswer("   ")).rejects.toThrow();
        await expect(hashAnswer("!!!")).rejects.toThrow();
    });

    it("returns false on a malformed stored hash rather than throwing", async () => {
        expect(await verifyAnswer("not-a-real-argon2-hash", "anything")).toBe(
            false,
        );
    });
});
