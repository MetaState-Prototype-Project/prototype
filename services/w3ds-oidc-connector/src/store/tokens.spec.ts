import { describe, expect, it } from "vitest";
import { AccessTokenStore } from "./tokens.js";

describe("AccessTokenStore", () => {
    it("returns a token's claims until it expires", () => {
        const store = new AccessTokenStore(1000);
        const token = store.issue("keycloak", { sub: "@alice" }, 0);
        expect(store.get(token, 999)?.claims).toEqual({ sub: "@alice" });
        expect(store.get(token, 1000)).toBeUndefined();
    });

    it("forgets a revoked token", () => {
        const store = new AccessTokenStore(1000);
        const token = store.issue("keycloak", {}, 0);
        store.revoke(token);
        expect(store.get(token, 1)).toBeUndefined();
    });

    it("sweeps expired tokens", () => {
        const store = new AccessTokenStore(1000);
        store.issue("keycloak", {}, 0);
        store.issue("keycloak", {}, 500);
        store.sweep(1000);
        expect(store.size).toBe(1);
    });
});
