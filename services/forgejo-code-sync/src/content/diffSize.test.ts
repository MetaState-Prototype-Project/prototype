import { describe, expect, it } from "vitest";
import { shouldInline } from "./diffSize.js";

describe("shouldInline", () => {
    it("inlines below the cap", () => {
        expect(shouldInline(100, 1000)).toBe(true);
    });

    it("inlines exactly at the cap", () => {
        expect(shouldInline(1000, 1000)).toBe(true);
    });

    it("does not inline above the cap", () => {
        expect(shouldInline(1001, 1000)).toBe(false);
    });

    it("never inlines when the cap is 0", () => {
        expect(shouldInline(0, 0)).toBe(true); // a genuinely empty diff still fits
        expect(shouldInline(1, 0)).toBe(false);
    });
});
