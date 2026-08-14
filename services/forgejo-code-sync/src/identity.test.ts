import { describe, expect, it, vi } from "vitest";
import { IdentityResolver, enameFromLoginName } from "./identity.js";

describe("enameFromLoginName", () => {
    it("returns the ename when login_name starts with @", () => {
        expect(enameFromLoginName("@alice")).toBe("@alice");
        expect(enameFromLoginName("@user-a.w3id")).toBe("@user-a.w3id");
    });

    it("returns null for an ordinary password account's login_name", () => {
        expect(enameFromLoginName("alice")).toBeNull();
    });

    it("returns null for an empty string", () => {
        expect(enameFromLoginName("")).toBeNull();
    });

    it("returns null when @ appears but not as the first character", () => {
        // Not a real GitW3 login_name shape, but the check is a strict prefix
        // check, not a "contains @" check - worth pinning down explicitly.
        expect(enameFromLoginName("foo@bar")).toBeNull();
    });
});

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

describe("IdentityResolver.resolveEname", () => {
    it("resolves a linked account's ename", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse(200, { login_name: "@alice" }));
        const resolver = new IdentityResolver({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            fetchImpl,
        });

        expect(await resolver.resolveEname("alice")).toBe("@alice");
        expect(fetchImpl).toHaveBeenCalledWith(
            "https://git.example.org/api/v1/users/alice",
            { headers: { Authorization: "token admin-token" } },
        );
    });

    it("returns null for an account with no linked eVault", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse(200, { login_name: "" }));
        const resolver = new IdentityResolver({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            fetchImpl,
        });

        expect(await resolver.resolveEname("bob")).toBeNull();
    });

    it("returns null when login_name is absent from the response entirely, not just empty", async () => {
        // Confirmed live against a real GitW3 instance, not assumed: Go's
        // `json:"login_name,omitempty"` means a password-registered account's
        // GET /users/{username} response omits the key outright rather than
        // sending `"login_name": ""` - `{ login_name: "" }` above is not the
        // only shape a "no linked eVault" account actually takes on the wire.
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse(200, { id: 3, login: "bob" }));
        const resolver = new IdentityResolver({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            fetchImpl,
        });

        expect(await resolver.resolveEname("bob")).toBeNull();
    });

    it("does not re-fetch within the TTL", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse(200, { login_name: "@alice" }));
        const resolver = new IdentityResolver({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            ttlMs: 1000,
            fetchImpl,
        });

        const now = Date.now();
        await resolver.resolveEname("alice", now);
        await resolver.resolveEname("alice", now + 500);

        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("re-fetches once the TTL has elapsed", async () => {
        // mockImplementation, not mockResolvedValue: a Response body can only
        // be read once, so reusing the same instance across calls would break
        // the second read rather than testing anything meaningful.
        const fetchImpl = vi
            .fn()
            .mockImplementation(async () =>
                jsonResponse(200, { login_name: "@alice" }),
            );
        const resolver = new IdentityResolver({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            ttlMs: 1000,
            fetchImpl,
        });

        const now = Date.now();
        await resolver.resolveEname("alice", now);
        await resolver.resolveEname("alice", now + 1001);

        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("caches a negative (no linked eVault) result too", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse(200, { login_name: "" }));
        const resolver = new IdentityResolver({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            fetchImpl,
        });

        const now = Date.now();
        await resolver.resolveEname("bob", now);
        await resolver.resolveEname("bob", now + 1);

        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("evicts a previously-cached entry on 404 rather than retrying it later", async () => {
        const fetchImpl = vi
            .fn()
            .mockImplementationOnce(async () =>
                jsonResponse(200, { login_name: "@alice" }),
            )
            .mockImplementationOnce(async () =>
                jsonResponse(404, { message: "not found" }),
            )
            .mockImplementationOnce(async () =>
                jsonResponse(200, { login_name: "@alice" }),
            );
        const resolver = new IdentityResolver({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            // Short TTL: the second call must land past it, or it would be
            // served from cache and never reach the queued 404 response at all.
            ttlMs: 10,
            fetchImpl,
        });

        const now = Date.now();
        expect(await resolver.resolveEname("alice", now)).toBe("@alice");
        // Past the TTL - a genuine re-fetch, landing on the account-deleted 404.
        expect(await resolver.resolveEname("alice", now + 20)).toBeNull();
        // The 404 evicted the cache entry rather than caching the null - a call
        // one millisecond later, well within what would otherwise be a fresh
        // TTL window, still has nothing cached and must fetch again. If the
        // 404 had merely returned null without evicting, this call would
        // wrongly serve a cached negative instead of hitting the stub a third
        // time.
        expect(await resolver.resolveEname("alice", now + 21)).toBe("@alice");
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it("throws on a non-404 error response, distinctly from returning null", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse(500, { message: "boom" }));
        const resolver = new IdentityResolver({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            fetchImpl,
        });

        // Must throw, not resolve to null - a 500 is "couldn't check right now,
        // retry", which the queue's backoff handles, not "no linked eVault".
        await expect(resolver.resolveEname("alice")).rejects.toThrow(/500/);
    });
});
