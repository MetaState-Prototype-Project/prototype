import { describe, expect, it } from "vitest";
import { isWalletVersionAtLeast } from "./wallet-version.js";

const atLeast040 = (version: string | undefined) =>
    isWalletVersionAtLeast(version, "0.4.0");

describe("isWalletVersionAtLeast", () => {
    it.each(["0.4.0", "0.4.1", "0.5.0", "1.0.0", "10.0.0", "0.10.0"])(
        "accepts %s",
        (version) => {
            expect(atLeast040(version)).toBe(true);
        },
    );

    it.each(["0.3.9", "0.0.1", "0.3.99"])("rejects %s", (version) => {
        expect(atLeast040(version)).toBe(false);
    });

    it("compares numerically, not as strings", () => {
        // "0.10.0" < "0.4.0" alphabetically, which is the classic way to get this
        // wrong and lock out every wallet past the ninth minor.
        expect(atLeast040("0.10.0")).toBe(true);
        expect(isWalletVersionAtLeast("0.4.0", "0.10.0")).toBe(false);
    });

    it("treats a missing component as zero", () => {
        // The reference implementation the platforms share does the same, so "0.4"
        // must not be rejected.
        expect(atLeast040("0.4")).toBe(true);
        expect(atLeast040("1")).toBe(true);
        expect(atLeast040("0.3")).toBe(false);
    });

    it("ignores anything past the third component", () => {
        expect(atLeast040("0.4.0.7")).toBe(true);
    });

    it("rejects a version it cannot parse", () => {
        // Treating an unparseable component as zero would let "abc" satisfy any
        // minimum of 0.x.
        for (const version of ["abc", "0.four.0", "", "v0.4.0"]) {
            expect(atLeast040(version)).toBe(false);
        }
    });

    it("rejects a wallet that sends no version", () => {
        expect(atLeast040(undefined)).toBe(false);
    });
});
