import { describe, expect, it, vi } from "vitest";
import type { RateLimitRule } from "../../entities/RateLimitRule";
import type { RateLimitSnapshot } from "../../services/RateLimitConfigService";
import {
    GlobalRateLimiter,
    createRateLimitHook,
    parseTrustProxy,
} from "./global-rate-limiter";
import { compileIpRules } from "./ip-rules";

type RuleSpec = Pick<RateLimitRule, "kind" | "subject" | "mode"> & {
    limitPerMinute?: number;
};

function makeSnapshot(
    specs: RuleSpec[] = [],
    defaults = { platform: 3, ip: 5 },
): RateLimitSnapshot {
    const rules = specs.map(
        (spec) => ({ limitPerMinute: null, ...spec }) as RateLimitRule,
    );
    return {
        source: "db",
        loadedAt: new Date(),
        platformDefault: { limit: defaults.platform, source: "env" },
        ipDefault: { limit: defaults.ip, source: "env" },
        platformRules: new Map(
            rules.filter((r) => r.kind === "platform").map((r) => [r.subject, r]),
        ),
        matchIp: compileIpRules(rules.filter((r) => r.kind === "ip")),
        rules,
    };
}

// A token is its own platform name here; "bad" stands for an invalid one.
const platformOf = async (token: string | null) =>
    token && token !== "bad" ? token : null;

function makeLimiter(specs: RuleSpec[] = [], defaults?: any) {
    const state = { snapshot: makeSnapshot(specs, defaults), now: 1_000_000 };
    const verify = vi.fn(platformOf);
    const limiter = new GlobalRateLimiter(
        () => state.snapshot,
        verify,
        () => state.now,
    );
    const hit = (ip = "203.0.113.7", token: string | null = null) =>
        limiter.check("POST", ip, token);
    const hits = async (n: number, ip?: string, token?: string | null) => {
        let last = await hit(ip, token);
        for (let i = 1; i < n; i++) last = await hit(ip, token);
        return last;
    };
    return { limiter, state, verify, hit, hits };
}

describe("GlobalRateLimiter", () => {
    it("allows requests up to the IP default, then rejects", async () => {
        const { hits, hit } = makeLimiter();
        expect(await hits(5)).toEqual({ allowed: true });
        expect(await hit()).toEqual({
            allowed: false,
            status: 429,
            scope: "ip",
            retryAfterSeconds: 60,
        });
    });

    it("counts each IP separately and a mapped address as its IPv4", async () => {
        const { hits, hit } = makeLimiter();
        await hits(5, "203.0.113.7");
        expect((await hit("198.51.100.1")).allowed).toBe(true);
        expect((await hit("::ffff:203.0.113.7")).allowed).toBe(false);
    });

    it("starts a new window after a minute", async () => {
        const { hits, hit, state } = makeLimiter();
        await hits(6);
        state.now += 60_001;
        expect((await hit()).allowed).toBe(true);
    });

    it("never counts a preflight", async () => {
        const { limiter, hits } = makeLimiter();
        for (let i = 0; i < 20; i++) {
            await limiter.check("OPTIONS", "203.0.113.7", null);
        }
        expect(await hits(5)).toEqual({ allowed: true });
    });

    it("applies a per-IP limit, raised or lowered", async () => {
        const { hits, hit } = makeLimiter([
            {
                kind: "ip",
                subject: "203.0.113.7/32",
                mode: "limit",
                limitPerMinute: 8,
            },
            {
                kind: "ip",
                subject: "198.51.100.0/24",
                mode: "limit",
                limitPerMinute: 1,
            },
        ]);
        expect((await hits(8)).allowed).toBe(true);
        expect((await hit()).allowed).toBe(false);
        expect((await hit("198.51.100.1")).allowed).toBe(true);
        expect((await hit("198.51.100.1")).allowed).toBe(false);
        // A range limit is per address, not one bucket for the range.
        expect((await hit("198.51.100.2")).allowed).toBe(true);
    });

    it("blocks an IP without counting it or reading its token", async () => {
        const { limiter, hit, verify } = makeLimiter([
            { kind: "ip", subject: "203.0.113.0/24", mode: "blocked" },
        ]);
        expect(await hit("203.0.113.7", "pictique")).toEqual({
            allowed: false,
            status: 403,
        });
        expect(verify).not.toHaveBeenCalled();
        expect(limiter.getUsage().ips).toEqual([]);
    });

    it("lets an exempt IP through everything", async () => {
        const { hits, verify } = makeLimiter([
            { kind: "ip", subject: "203.0.113.7/32", mode: "exempt" },
            { kind: "platform", subject: "pictique", mode: "blocked" },
        ]);
        expect(await hits(50, "203.0.113.7", "pictique")).toEqual({
            allowed: true,
        });
        expect(verify).not.toHaveBeenCalled();
    });

    it("prefers the most specific IP rule", async () => {
        const { hit } = makeLimiter([
            { kind: "ip", subject: "203.0.113.0/24", mode: "blocked" },
            { kind: "ip", subject: "203.0.113.7/32", mode: "exempt" },
        ]);
        expect((await hit("203.0.113.7")).allowed).toBe(true);
        expect((await hit("203.0.113.8")).allowed).toBe(false);
    });

    it("holds a platform to its default across IPs", async () => {
        const { hit } = makeLimiter();
        for (let i = 1; i <= 3; i++) {
            expect((await hit(`198.51.100.${i}`, "pictique")).allowed).toBe(
                true,
            );
        }
        expect(await hit("198.51.100.4", "pictique")).toEqual({
            allowed: false,
            status: 429,
            scope: "platform",
            retryAfterSeconds: 60,
        });
        expect((await hit("198.51.100.5", "blabsy")).allowed).toBe(true);
    });

    it("applies a per-platform limit", async () => {
        const { hit } = makeLimiter(
            [
                {
                    kind: "platform",
                    subject: "pictique",
                    mode: "limit",
                    limitPerMinute: 4,
                },
            ],
            { platform: 1, ip: 100 },
        );
        for (let i = 0; i < 4; i++) {
            expect((await hit("203.0.113.7", "pictique")).allowed).toBe(true);
        }
        expect((await hit("203.0.113.7", "pictique")).allowed).toBe(false);
    });

    it("keeps the IP limit as the ceiling over any platform rule", async () => {
        const { hits, hit } = makeLimiter([
            {
                kind: "platform",
                subject: "pictique",
                mode: "limit",
                limitPerMinute: 1000,
            },
            { kind: "platform", subject: "blabsy", mode: "exempt" },
        ]);
        expect((await hits(5, "203.0.113.7", "pictique")).allowed).toBe(true);
        expect(await hit("203.0.113.7", "pictique")).toMatchObject({
            status: 429,
            scope: "ip",
        });
        expect((await hits(5, "198.51.100.1", "blabsy")).allowed).toBe(true);
        expect(await hit("198.51.100.1", "blabsy")).toMatchObject({
            status: 429,
            scope: "ip",
        });
    });

    it("exempts a platform from its own bucket only", async () => {
        const { limiter, hits } = makeLimiter(
            [{ kind: "platform", subject: "pictique", mode: "exempt" }],
            { platform: 1, ip: 100 },
        );
        expect((await hits(50, "203.0.113.7", "pictique")).allowed).toBe(true);
        expect(limiter.getUsage().platforms).toEqual([]);
    });

    it("blocks a platform", async () => {
        const { hit } = makeLimiter([
            { kind: "platform", subject: "pictique", mode: "blocked" },
        ]);
        expect(await hit("203.0.113.7", "pictique")).toEqual({
            allowed: false,
            status: 403,
        });
        expect((await hit("203.0.113.7", "blabsy")).allowed).toBe(true);
    });

    it("treats an unverifiable token as no platform", async () => {
        const { limiter, hits } = makeLimiter([], { platform: 1, ip: 100 });
        expect((await hits(10, "203.0.113.7", "bad")).allowed).toBe(true);
        expect(limiter.getUsage().platforms).toEqual([]);
    });

    it("does not verify a token once the IP is over its limit", async () => {
        const { hits, hit, verify } = makeLimiter();
        await hits(5, "203.0.113.7", "pictique");
        verify.mockClear();
        await hit("203.0.113.7", "pictique");
        expect(verify).not.toHaveBeenCalled();
    });

    it("lifts a throttled caller as soon as its limit is raised", async () => {
        const { hits, hit, state } = makeLimiter();
        await hits(6);
        expect((await hit()).allowed).toBe(false);
        state.snapshot = makeSnapshot([
            {
                kind: "ip",
                subject: "203.0.113.7/32",
                mode: "limit",
                limitPerMinute: 100,
            },
        ]);
        expect((await hit()).allowed).toBe(true);
    });

    it("reports live usage, busiest first", async () => {
        const { limiter, hits, state } = makeLimiter([
            {
                kind: "ip",
                subject: "198.51.100.0/24",
                mode: "limit",
                limitPerMinute: 100,
            },
        ]);
        await hits(7, "203.0.113.7", "pictique");
        await hits(2, "198.51.100.1");
        state.now += 15_000;

        const usage = limiter.getUsage();
        expect(usage.windowSeconds).toBe(60);
        expect(usage.truncated).toBe(false);
        expect(usage.ips).toEqual([
            {
                subject: "203.0.113.7",
                count: 7,
                rejected: 2,
                limit: 5,
                mode: "limit",
                matchedRule: null,
                resetsInSeconds: 45,
            },
            {
                subject: "198.51.100.1",
                count: 2,
                rejected: 0,
                limit: 100,
                mode: "limit",
                matchedRule: "198.51.100.0/24",
                resetsInSeconds: 45,
            },
        ]);
        expect(usage.platforms).toEqual([
            {
                subject: "pictique",
                count: 5,
                rejected: 2,
                limit: 3,
                mode: "limit",
                matchedRule: null,
                resetsInSeconds: 45,
            },
        ]);

        state.now += 60_000;
        expect(limiter.getUsage().ips).toEqual([]);
    });
});

describe("createRateLimitHook", () => {
    function makeReply() {
        const reply: any = { headers: {} };
        reply.code = vi.fn((status: number) => {
            reply.status = status;
            return reply;
        });
        reply.header = vi.fn((name: string, value: string) => {
            reply.headers[name] = value;
            return reply;
        });
        reply.send = vi.fn((body: unknown) => {
            reply.body = body;
            return reply;
        });
        return reply;
    }

    const request = (authorization?: string) =>
        ({
            method: "POST",
            ip: "203.0.113.7",
            headers: { authorization },
        }) as any;

    it("passes an allowed request through untouched", async () => {
        const { limiter } = makeLimiter();
        const reply = makeReply();
        const result = await createRateLimitHook(limiter)(request(), reply);
        expect(result).toBeUndefined();
        expect(reply.send).not.toHaveBeenCalled();
    });

    it("answers 429 with Retry-After and the scope", async () => {
        const { limiter } = makeLimiter([], { platform: 1, ip: 100 });
        const hook = createRateLimitHook(limiter);
        await hook(request("Bearer pictique"), makeReply());
        const reply = makeReply();
        expect(await hook(request("Bearer pictique"), reply)).toBe(reply);
        expect(reply.status).toBe(429);
        expect(reply.headers["Retry-After"]).toBe("60");
        expect(reply.body).toEqual({
            error: "Too Many Requests",
            retryAfterSeconds: 60,
            scope: "platform",
        });
    });

    it("answers 403 for a blocked caller", async () => {
        const { limiter } = makeLimiter([
            { kind: "ip", subject: "203.0.113.7/32", mode: "blocked" },
        ]);
        const reply = makeReply();
        expect(await createRateLimitHook(limiter)(request(), reply)).toBe(
            reply,
        );
        expect(reply.status).toBe(403);
        expect(reply.body).toEqual({ error: "Forbidden" });
    });
});

describe("parseTrustProxy", () => {
    it("trusts nothing unless told to", () => {
        expect(parseTrustProxy(undefined)).toBe(false);
        expect(parseTrustProxy("")).toBe(false);
        expect(parseTrustProxy("false")).toBe(false);
    });

    it("reads true, a hop count and an address list", () => {
        expect(parseTrustProxy("TRUE")).toBe(true);
        expect(parseTrustProxy(" 2 ")).toBe(2);
        expect(parseTrustProxy("10.0.0.0/8, 127.0.0.1")).toBe(
            "10.0.0.0/8, 127.0.0.1",
        );
    });
});
