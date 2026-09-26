import { describe, expect, it } from "vitest";
import {
    type GlobalRateLimitInput,
    createGlobalRateLimiter,
} from "./global-rate-limiter";
import { isGraphQLReadOperation } from "./graphql-rate-limit-intent";

const authenticatedPlatform = async (token: string): Promise<string | null> =>
    token === "valid-platform-token" ? "@vidak" : null;

function read(
    overrides: Partial<GlobalRateLimitInput> = {},
): GlobalRateLimitInput {
    return {
        token: "valid-platform-token",
        ip: "198.51.100.10",
        eName: "@viewer-a",
        intent: "read",
        ...overrides,
    };
}

function write(
    overrides: Partial<GlobalRateLimitInput> = {},
): GlobalRateLimitInput {
    return {
        token: "valid-platform-token",
        ip: "198.51.100.10",
        eName: "@viewer-a",
        intent: "write",
        ...overrides,
    };
}

describe("global rate limiter", () => {
    it("isolates authenticated read quotas by platform and valid X-ENAME while retaining an aggregate cap", async () => {
        const limiter = createGlobalRateLimiter({
            authenticatePlatform: authenticatedPlatform,
            readRequestsPerTenant: 2,
            readRequestsPerPlatform: 4,
            readRequestsPerPlatformIp: 10,
            writeRequestsPerPlatform: 2,
            requestsPerIp: 2,
        });

        expect((await limiter.check(read())).allowed).toBe(true);
        expect(
            (await limiter.check(read({ eName: " @VIEWER-A " }))).allowed,
        ).toBe(true);
        const exhaustedTenant = await limiter.check(read());
        expect(exhaustedTenant).toEqual({
            allowed: false,
            retryAfterSeconds: 60,
        });

        expect(
            (await limiter.check(read({ eName: "@viewer-b" }))).allowed,
        ).toBe(true);
        expect(
            (await limiter.check(read({ eName: "@viewer-b" }))).allowed,
        ).toBe(true);
        const exhaustedPlatform = await limiter.check(
            read({ eName: "@viewer-c" }),
        );
        expect(exhaustedPlatform).toEqual({
            allowed: false,
            retryAfterSeconds: 60,
        });
    });

    it("keeps an authenticated platform/IP cap across independent tenants", async () => {
        const limiter = createGlobalRateLimiter({
            authenticatePlatform: authenticatedPlatform,
            readRequestsPerTenant: 10,
            readRequestsPerPlatform: 10,
            readRequestsPerPlatformIp: 2,
            writeRequestsPerPlatform: 10,
            requestsPerIp: 10,
        });

        expect(
            (await limiter.check(read({ eName: "@viewer-a" }))).allowed,
        ).toBe(true);
        expect(
            (await limiter.check(read({ eName: "@viewer-b" }))).allowed,
        ).toBe(true);
        expect(await limiter.check(read({ eName: "@viewer-c" }))).toEqual({
            allowed: false,
            retryAfterSeconds: 60,
        });
    });

    it("keeps writes on the original platform-wide quota regardless of X-ENAME", async () => {
        const limiter = createGlobalRateLimiter({
            authenticatePlatform: authenticatedPlatform,
            readRequestsPerTenant: 10,
            readRequestsPerPlatform: 10,
            readRequestsPerPlatformIp: 10,
            writeRequestsPerPlatform: 2,
            requestsPerIp: 10,
        });

        expect(
            (await limiter.check(write({ eName: "@viewer-a" }))).allowed,
        ).toBe(true);
        expect(
            (await limiter.check(write({ eName: "@viewer-b" }))).allowed,
        ).toBe(true);
        expect(await limiter.check(write({ eName: "@viewer-c" }))).toEqual({
            allowed: false,
            retryAfterSeconds: 60,
        });
    });

    it("keeps unknown tokens and malformed X-ENAME values on strict legacy buckets", async () => {
        const limiter = createGlobalRateLimiter({
            authenticatePlatform: authenticatedPlatform,
            readRequestsPerTenant: 10,
            readRequestsPerPlatform: 10,
            readRequestsPerPlatformIp: 10,
            writeRequestsPerPlatform: 2,
            requestsPerIp: 2,
        });

        expect(
            (await limiter.check(read({ token: "forged", eName: "@viewer-a" })))
                .allowed,
        ).toBe(true);
        expect(
            (await limiter.check(read({ token: "forged", eName: "@viewer-b" })))
                .allowed,
        ).toBe(true);
        expect(
            await limiter.check(read({ token: "forged", eName: "@viewer-c" })),
        ).toEqual({
            allowed: false,
            retryAfterSeconds: 60,
        });

        const strictTenant = createGlobalRateLimiter({
            authenticatePlatform: authenticatedPlatform,
            readRequestsPerTenant: 10,
            readRequestsPerPlatform: 10,
            readRequestsPerPlatformIp: 10,
            writeRequestsPerPlatform: 2,
            requestsPerIp: 10,
        });
        expect(
            (await strictTenant.check(read({ eName: "not-an-ename" }))).allowed,
        ).toBe(true);
        expect(
            (await strictTenant.check(read({ eName: "not-an-ename" }))).allowed,
        ).toBe(true);
        expect(
            await strictTenant.check(read({ eName: "not-an-ename" })),
        ).toEqual({
            allowed: false,
            retryAfterSeconds: 60,
        });
    });

    it("resets a tenant bucket after its fixed window and reports Retry-After", async () => {
        let now = 1_000;
        const limiter = createGlobalRateLimiter({
            authenticatePlatform: authenticatedPlatform,
            now: () => now,
            readRequestsPerTenant: 1,
            readRequestsPerPlatform: 10,
            readRequestsPerPlatformIp: 10,
            writeRequestsPerPlatform: 10,
            requestsPerIp: 10,
        });

        expect((await limiter.check(read())).allowed).toBe(true);
        expect(await limiter.check(read())).toEqual({
            allowed: false,
            retryAfterSeconds: 60,
        });
        now += 60_001;
        expect((await limiter.check(read())).allowed).toBe(true);
    });
});

describe("GraphQL rate-limit intent", () => {
    it("admits only an unambiguous selected query to the read path", () => {
        expect(
            isGraphQLReadOperation({
                query: 'query Videos { metaEnvelope(id: "x") { id } }',
            }),
        ).toBe(true);
        expect(
            isGraphQLReadOperation({
                query: "mutation Upload { createMetaEnvelope(input: {}) { errors } }",
            }),
        ).toBe(false);
        expect(
            isGraphQLReadOperation({
                query: 'query Read { metaEnvelope(id: "x") { id } } mutation Write { removeMetaEnvelope(id: "x") { errors } }',
            }),
        ).toBe(false);
        expect(
            isGraphQLReadOperation({
                operationName: "Read",
                query: 'query Read { metaEnvelope(id: "x") { id } } mutation Write { removeMetaEnvelope(id: "x") { errors } }',
            }),
        ).toBe(true);
        expect(
            isGraphQLReadOperation({
                operationName: "Write",
                query: 'query Read { metaEnvelope(id: "x") { id } } mutation Write { removeMetaEnvelope(id: "x") { errors } }',
            }),
        ).toBe(false);
    });
});
