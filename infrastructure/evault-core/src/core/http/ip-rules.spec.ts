import { describe, expect, it } from "vitest";
import {
    canonicalizeSubject,
    compileIpRules,
    hostBits,
    isTooBroad,
    normalizeIp,
} from "./ip-rules";

describe("ip-rules", () => {
    describe("normalizeIp", () => {
        it("unwraps an IPv4-mapped IPv6 address", () => {
            expect(normalizeIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
        });

        it("compresses IPv6 to one spelling", () => {
            expect(normalizeIp("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(
                "2001:db8::1",
            );
        });

        it("returns unparseable input unchanged", () => {
            expect(normalizeIp("unknown")).toBe("unknown");
        });
    });

    describe("canonicalizeSubject", () => {
        it("turns a bare address into a single-address range", () => {
            expect(canonicalizeSubject(" 203.0.113.7 ")).toBe("203.0.113.7/32");
            expect(canonicalizeSubject("2001:db8::1")).toBe("2001:db8::1/128");
        });

        it("zeroes host bits", () => {
            expect(canonicalizeSubject("203.0.113.7/24")).toBe("203.0.113.0/24");
            expect(canonicalizeSubject("2001:db8::1/32")).toBe("2001:db8::/32");
        });

        it("stores a mapped IPv4 range as IPv4", () => {
            expect(canonicalizeSubject("::ffff:203.0.113.7")).toBe(
                "203.0.113.7/32",
            );
            expect(canonicalizeSubject("::ffff:203.0.113.7/120")).toBe(
                "203.0.113.0/24",
            );
        });

        it("rejects invalid input", () => {
            for (const bad of [
                "",
                "nope",
                "10",
                "1.2.3.4/33",
                "1.2.3/24",
                "*",
                "::ffff:0:0/95",
            ]) {
                expect(() => canonicalizeSubject(bad)).toThrow();
            }
        });
    });

    it("flags ranges too broad to block or exempt", () => {
        expect(isTooBroad("10.0.0.0/8")).toBe(false);
        expect(isTooBroad("0.0.0.0/0")).toBe(true);
        expect(isTooBroad("8.0.0.0/7")).toBe(true);
        expect(isTooBroad("2001:db8::/32")).toBe(false);
        expect(isTooBroad("2000::/3")).toBe(true);
    });

    it("counts the host bits of a range", () => {
        expect(hostBits("203.0.113.0/24")).toBe(8);
        expect(hostBits("203.0.113.7/32")).toBe(0);
    });

    describe("compileIpRules", () => {
        const match = compileIpRules([
            { subject: "10.0.0.0/8", name: "wide" },
            { subject: "10.1.2.3/32", name: "host" },
            { subject: "10.1.0.0/16", name: "mid" },
            { subject: "2001:db8::/32", name: "v6" },
            { subject: "garbage", name: "bad" },
        ]);

        it("picks the most specific range", () => {
            expect(match("10.1.2.3")?.name).toBe("host");
            expect(match("10.1.9.9")?.name).toBe("mid");
            expect(match("10.200.0.1")?.name).toBe("wide");
        });

        it("matches a mapped IPv4 client against IPv4 rules", () => {
            expect(match("::ffff:10.1.2.3")?.name).toBe("host");
        });

        it("matches IPv6 and keeps the families apart", () => {
            expect(match("2001:db8::42")?.name).toBe("v6");
            expect(match("2001:db9::1")).toBeNull();
        });

        it("matches nothing for an uncovered or invalid address", () => {
            expect(match("192.0.2.1")).toBeNull();
            expect(match("unknown")).toBeNull();
        });
    });
});
