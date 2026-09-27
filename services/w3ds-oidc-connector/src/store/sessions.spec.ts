import { describe, expect, it } from "vitest";
import type { AuthorizationRequest, Identity } from "../types.js";
import { SessionStore } from "./sessions.js";

const REQUEST: AuthorizationRequest = {
    clientId: "keycloak",
    redirectUri: "https://kc.example/cb",
    state: "st",
    nonce: "n",
    codeChallenge: "c".repeat(43),
    scope: ["openid"],
};
const IDENTITY: Identity = { eName: "@alice", amr: ["swk"], authTime: 1 };
const TTL = 300_000;

describe("SessionStore", () => {
    it("creates a pending session with an unguessable id", () => {
        const store = new SessionStore(TTL);
        const a = store.create(REQUEST, "browser", 0);
        const b = store.create(REQUEST, "browser", 0);
        expect(a.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(a.id).not.toBe(b.id);
        expect(a.status).toBe("pending");
    });

    it("tells unknown, live and expired sessions apart", () => {
        const store = new SessionStore(TTL);
        const { id } = store.create(REQUEST, "browser", 0);
        expect(store.lookup("nope", 0).state).toBe("unknown");
        expect(store.lookup(id, TTL - 1).state).toBe("live");
        expect(store.lookup(id, TTL).state).toBe("expired");
    });

    it("approves a pending session once", () => {
        const store = new SessionStore(TTL);
        const { id } = store.create(REQUEST, "browser", 0);
        expect(store.approve(id, IDENTITY, 10)).toBe(true);
        expect(store.approve(id, IDENTITY, 11)).toBe(false);
    });

    it("does not approve an expired session", () => {
        const store = new SessionStore(TTL);
        const { id } = store.create(REQUEST, "browser", 0);
        expect(store.approve(id, IDENTITY, TTL)).toBe(false);
    });

    it("keeps an approved session alive long enough to collect", () => {
        const store = new SessionStore(TTL);
        const { id } = store.create(REQUEST, "browser", 0);
        store.approve(id, IDENTITY, TTL - 1000);
        expect(store.lookup(id, TTL + 60_000).state).toBe("live");
    });

    it("hands an approved session only to its own browser, once", () => {
        const store = new SessionStore(TTL);
        const { id } = store.create(REQUEST, "browser", 0);
        expect(store.claim(id, "browser", 1)).toBeUndefined();
        store.approve(id, IDENTITY, 1);
        expect(store.claim(id, "someone-else", 2)).toBeUndefined();
        expect(store.claim(id, undefined, 2)).toBeUndefined();
        expect(store.claim(id, "browser", 2)?.identity).toEqual(IDENTITY);
        expect(store.claim(id, "browser", 3)).toBeUndefined();
    });

    it("sweeps expired sessions", () => {
        const store = new SessionStore(TTL);
        store.create(REQUEST, "browser", 0);
        store.create(REQUEST, "browser", 100_000);
        store.sweep(TTL);
        expect(store.size).toBe(1);
    });
});
