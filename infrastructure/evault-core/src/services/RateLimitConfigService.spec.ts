import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitRule } from "../entities/RateLimitRule";
import {
    RateLimitConfigService,
    RuleValidationError,
    validateRuleInput,
} from "./RateLimitConfigService";

function makeRepoStub(initial: Partial<RateLimitRule>[] = []) {
    const rows = new Map<string, RateLimitRule>();
    let nextId = 1;
    const add = (partial: Partial<RateLimitRule>) => {
        const row = {
            id: partial.id ?? `id-${nextId++}`,
            limitPerMinute: null,
            note: null,
            updatedBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...partial,
        } as RateLimitRule;
        rows.set(row.id, row);
        return row;
    };
    initial.forEach(add);
    const stub = {
        failing: false,
        async find() {
            if (stub.failing) throw new Error("db down");
            return [...rows.values()];
        },
        async findOne({ where }: { where: Partial<RateLimitRule> }) {
            return (
                [...rows.values()].find(
                    (r) =>
                        r.kind === where.kind && r.subject === where.subject,
                ) ?? null
            );
        },
        create(partial: Partial<RateLimitRule>) {
            return partial as RateLimitRule;
        },
        async save(row: RateLimitRule) {
            return add(row);
        },
        async delete({ id }: { id: string }) {
            return { affected: rows.delete(id) ? 1 : 0 };
        },
    };
    return stub as any;
}

describe("RateLimitConfigService", () => {
    const saved = { ...process.env };

    beforeEach(() => {
        delete process.env.RATE_LIMIT_PER_PLATFORM;
        delete process.env.RATE_LIMIT_PER_IP;
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        process.env = { ...saved };
        vi.restoreAllMocks();
    });

    it("uses the built-in defaults before anything is loaded", () => {
        const service = new RateLimitConfigService(makeRepoStub());
        expect(service.snapshot.source).toBe("env");
        expect(service.snapshot.platformDefault).toEqual({
            limit: 250,
            source: "env",
        });
        expect(service.snapshot.ipDefault).toEqual({
            limit: 500,
            source: "env",
        });
    });

    it("takes defaults from env when the table has none", async () => {
        process.env.RATE_LIMIT_PER_PLATFORM = "40";
        process.env.RATE_LIMIT_PER_IP = "nonsense";
        const service = new RateLimitConfigService(makeRepoStub());
        await service.reload();
        expect(service.snapshot.source).toBe("db");
        expect(service.snapshot.platformDefault.limit).toBe(40);
        expect(service.snapshot.ipDefault.limit).toBe(500);
    });

    it("lets a stored default override env", async () => {
        process.env.RATE_LIMIT_PER_IP = "40";
        const service = new RateLimitConfigService(
            makeRepoStub([
                { kind: "ip", subject: "*", mode: "limit", limitPerMinute: 9 },
            ]),
        );
        await service.reload();
        expect(service.snapshot.ipDefault).toEqual({ limit: 9, source: "db" });
        expect(service.snapshot.matchIp("203.0.113.7")).toBeNull();
    });

    it("indexes platform and IP rules", async () => {
        const service = new RateLimitConfigService(
            makeRepoStub([
                {
                    kind: "platform",
                    subject: "http://pictique.test",
                    mode: "limit",
                    limitPerMinute: 1000,
                },
                { kind: "ip", subject: "203.0.113.0/24", mode: "blocked" },
            ]),
        );
        await service.reload();
        expect(
            service.snapshot.platformRules.get("http://pictique.test")
                ?.limitPerMinute,
        ).toBe(1000);
        expect(service.snapshot.matchIp("203.0.113.7")?.mode).toBe("blocked");
    });

    it("skips a malformed row and keeps the rest", async () => {
        const service = new RateLimitConfigService(
            makeRepoStub([
                { kind: "ip", subject: "203.0.113.7/32", mode: "limit" },
                { kind: "ip", subject: "198.51.100.1/32", mode: "exempt" },
            ]),
        );
        await service.reload();
        expect(service.snapshot.rules).toHaveLength(1);
        expect(service.snapshot.matchIp("198.51.100.1")?.mode).toBe("exempt");
    });

    it("falls back to env defaults when the first load fails", async () => {
        const repo = makeRepoStub();
        repo.failing = true;
        const service = new RateLimitConfigService(repo);
        await service.reload();
        expect(service.snapshot.source).toBe("env");
        expect(service.snapshot.ipDefault.limit).toBe(500);
    });

    it("keeps the last loaded rules when a later load fails", async () => {
        const repo = makeRepoStub([
            { kind: "ip", subject: "203.0.113.7/32", mode: "blocked" },
        ]);
        const service = new RateLimitConfigService(repo);
        await service.reload();
        repo.failing = true;
        await service.reload();
        expect(service.snapshot.matchIp("203.0.113.7")?.mode).toBe("blocked");
    });

    it("applies a write immediately and replaces a subject's rule", async () => {
        const service = new RateLimitConfigService(makeRepoStub());
        await service.upsert({
            kind: "ip",
            subject: "203.0.113.7",
            mode: "limit",
            limitPerMinute: 5,
        });
        expect(service.snapshot.matchIp("203.0.113.7")?.limitPerMinute).toBe(5);

        const replaced = await service.upsert({
            kind: "ip",
            subject: "203.0.113.7/32",
            mode: "exempt",
        });
        expect(service.snapshot.rules).toHaveLength(1);
        expect(service.snapshot.matchIp("203.0.113.7")?.mode).toBe("exempt");
        expect(replaced.limitPerMinute).toBeNull();

        expect(await service.remove(replaced.id)).toBe(true);
        expect(service.snapshot.matchIp("203.0.113.7")).toBeNull();
        expect(await service.remove("missing")).toBe(false);
    });

    describe("validateRuleInput", () => {
        const field = (input: any) => {
            try {
                validateRuleInput(input);
                return null;
            } catch (error) {
                expect(error).toBeInstanceOf(RuleValidationError);
                return (error as RuleValidationError).field;
            }
        };

        it("accepts and canonicalises a valid rule", () => {
            expect(
                validateRuleInput({
                    kind: "ip",
                    subject: "203.0.113.7/24",
                    mode: "limit",
                    limitPerMinute: 10,
                    note: "office",
                }),
            ).toEqual({
                kind: "ip",
                subject: "203.0.113.0/24",
                mode: "limit",
                limitPerMinute: 10,
                note: "office",
                updatedBy: null,
            });
        });

        it("drops the limit of a block or exempt rule", () => {
            expect(
                validateRuleInput({
                    kind: "platform",
                    subject: " http://pictique.test ",
                    mode: "blocked",
                    limitPerMinute: 10,
                }),
            ).toMatchObject({
                subject: "http://pictique.test",
                limitPerMinute: null,
            });
        });

        it("names the field that is wrong", () => {
            const ok = {
                kind: "ip",
                subject: "203.0.113.7",
                mode: "limit",
                limitPerMinute: 10,
            };
            expect(field({ ...ok, kind: "user" })).toBe("kind");
            expect(field({ ...ok, mode: "allow" })).toBe("mode");
            expect(field({ ...ok, subject: "" })).toBe("subject");
            expect(field({ ...ok, subject: "nope" })).toBe("subject");
            expect(field({ ...ok, limitPerMinute: 0 })).toBe("limitPerMinute");
            expect(field({ ...ok, limitPerMinute: 1.5 })).toBe(
                "limitPerMinute",
            );
            expect(field({ ...ok, limitPerMinute: "10" })).toBe(
                "limitPerMinute",
            );
            expect(field({ ...ok, limitPerMinute: 1_000_001 })).toBe(
                "limitPerMinute",
            );
            expect(field({ ...ok, note: "x".repeat(501) })).toBe("note");
            expect(
                field({ ...ok, kind: "platform", subject: "x".repeat(257) }),
            ).toBe("subject");
        });

        it("refuses to block or exempt a default or a huge range", () => {
            expect(field({ kind: "ip", subject: "*", mode: "blocked" })).toBe(
                "mode",
            );
            expect(
                field({ kind: "ip", subject: "0.0.0.0/0", mode: "exempt" }),
            ).toBe("subject");
            expect(
                field({
                    kind: "ip",
                    subject: "0.0.0.0/0",
                    mode: "limit",
                    limitPerMinute: 5,
                }),
            ).toBeNull();
        });
    });
});
