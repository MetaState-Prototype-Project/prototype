import "reflect-metadata";
import type { AddressInfo } from "node:net";
import express from "express";
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { GlobalRateLimiter } from "../core/http/global-rate-limiter";
import type { RateLimitRule } from "../entities/RateLimitRule";
import { RateLimitConfigService } from "../services/RateLimitConfigService";
import { RateLimitAdminController } from "./RateLimitAdminController";

const SECRET = "test-admin-secret";
const RULE_ID = "3f1c2a52-6f0b-4d6e-9d57-0d0f3a1b2c3d";

function makeRepoStub() {
    const rows = new Map<string, RateLimitRule>();
    return {
        async find() {
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
            row.id ??= RULE_ID;
            rows.set(row.id, row);
            return row;
        },
        async delete({ id }: { id: string }) {
            return { affected: rows.delete(id) ? 1 : 0 };
        },
    } as any;
}

describe("RateLimitAdminController", () => {
    const previousSecret = process.env.RATE_LIMIT_ADMIN_SECRET;
    let server: ReturnType<express.Express["listen"]>;
    let baseUrl: string;
    let config: RateLimitConfigService;
    let limiter: GlobalRateLimiter;

    const call = (
        path: string,
        init: RequestInit & { secret?: string | null } = {},
    ) => {
        const { secret = SECRET, ...rest } = init;
        return fetch(`${baseUrl}${path}`, {
            ...rest,
            headers: {
                "content-type": "application/json",
                ...(secret ? { "x-shared-secret": secret } : {}),
            },
        });
    };

    const put = (body: unknown) =>
        call("/admin/rate-limits/rules", {
            method: "PUT",
            body: JSON.stringify(body),
        });

    beforeAll(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterAll(() => {
        vi.restoreAllMocks();
        if (previousSecret === undefined) {
            delete process.env.RATE_LIMIT_ADMIN_SECRET;
        } else {
            process.env.RATE_LIMIT_ADMIN_SECRET = previousSecret;
        }
    });

    beforeEach(() => {
        process.env.RATE_LIMIT_ADMIN_SECRET = SECRET;
        config = new RateLimitConfigService(makeRepoStub());
        limiter = new GlobalRateLimiter(
            () => config.snapshot,
            async () => null,
        );
        const app = express();
        app.use(express.json());
        new RateLimitAdminController(config, limiter).registerRoutes(app);
        server = app.listen(0);
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("is disabled while no secret is configured", async () => {
        delete process.env.RATE_LIMIT_ADMIN_SECRET;
        expect((await call("/admin/rate-limits")).status).toBe(503);
        expect((await put({})).status).toBe(503);
    });

    it("rejects a missing or wrong secret on every route", async () => {
        for (const secret of [null, "wrong", `${SECRET}x`]) {
            expect((await call("/admin/rate-limits", { secret })).status).toBe(
                401,
            );
            expect(
                (await call("/admin/rate-limits/usage", { secret })).status,
            ).toBe(401);
            expect(
                (
                    await call("/admin/rate-limits/rules", {
                        secret,
                        method: "PUT",
                        body: "{}",
                    })
                ).status,
            ).toBe(401);
            expect(
                (
                    await call(`/admin/rate-limits/rules/${RULE_ID}`, {
                        secret,
                        method: "DELETE",
                    })
                ).status,
            ).toBe(401);
        }
    });

    it("lists defaults and rules", async () => {
        const response = await call("/admin/rate-limits");
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            windowSeconds: 60,
            config: { source: "env" },
            trustProxy: false,
            defaults: {
                platform: { limit: 250, source: "env" },
                ip: { limit: 500, source: "env" },
            },
            rules: [],
        });
    });

    it("saves a rule and applies it at once", async () => {
        const response = await put({
            kind: "ip",
            subject: "203.0.113.7",
            mode: "limit",
            limitPerMinute: 1,
            updatedBy: "@admin",
        });
        expect(response.status).toBe(200);
        expect((await response.json()).rule).toMatchObject({
            id: RULE_ID,
            subject: "203.0.113.7/32",
            updatedBy: "@admin",
        });

        await limiter.check("GET", "203.0.113.7", null);
        expect((await limiter.check("GET", "203.0.113.7", null)).allowed).toBe(
            false,
        );

        const listed = await (await call("/admin/rate-limits")).json();
        expect(listed.rules).toHaveLength(1);
        expect(listed.config.source).toBe("db");
    });

    it("explains an invalid rule", async () => {
        const response = await put({
            kind: "ip",
            subject: "not-an-ip",
            mode: "blocked",
        });
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            error: "Not a valid IP address or CIDR range",
            field: "subject",
        });
    });

    it("removes a rule", async () => {
        await put({ kind: "platform", subject: "pictique", mode: "blocked" });
        const path = `/admin/rate-limits/rules/${RULE_ID}`;
        expect((await call(path, { method: "DELETE" })).status).toBe(204);
        expect(config.snapshot.rules).toEqual([]);
        expect((await call(path, { method: "DELETE" })).status).toBe(404);
        expect(
            (await call("/admin/rate-limits/rules/nope", { method: "DELETE" }))
                .status,
        ).toBe(404);
    });

    it("reports live usage", async () => {
        await limiter.check("GET", "203.0.113.7", null);
        const usage = await (await call("/admin/rate-limits/usage")).json();
        expect(usage.ips).toMatchObject([
            { subject: "203.0.113.7", count: 1, limit: 500 },
        ]);
        expect(usage.platforms).toEqual([]);
    });
});
