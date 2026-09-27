import { describe, expect, it } from "vitest";
import { type CodeRecord, CodeStore } from "./codes.js";

const RECORD: CodeRecord = {
    clientId: "keycloak",
    redirectUri: "https://kc.example/cb",
    codeChallenge: "c".repeat(43),
    scope: ["openid"],
    identity: { eName: "@alice", amr: ["swk"], authTime: 1 },
};

describe("CodeStore", () => {
    it("exchanges a code exactly once", () => {
        const store = new CodeStore(60_000, 300_000);
        const code = store.issue(RECORD, 0);
        expect(store.consume(code, 1)).toEqual({
            status: "ok",
            record: RECORD,
        });
        expect(store.consume(code, 2)).toEqual({
            status: "replayed",
            accessTokens: [],
        });
    });

    it("reports the access tokens to revoke on replay", () => {
        const store = new CodeStore(60_000, 300_000);
        const code = store.issue(RECORD, 0);
        store.consume(code, 1);
        store.recordAccessToken(code, "at-1");
        expect(store.consume(code, 2)).toEqual({
            status: "replayed",
            accessTokens: ["at-1"],
        });
    });

    it("rejects and burns an expired code", () => {
        const store = new CodeStore(60_000, 300_000);
        const code = store.issue(RECORD, 0);
        expect(store.consume(code, 60_000)).toEqual({ status: "invalid" });
        expect(store.consume(code, 60_001).status).toBe("replayed");
    });

    it("rejects an unknown code", () => {
        expect(new CodeStore(60_000, 300_000).consume("nope", 0)).toEqual({
            status: "invalid",
        });
    });

    it("keeps a used code's tombstone until the tokens it issued expire", () => {
        const store = new CodeStore(60_000, 300_000);
        const code = store.issue(RECORD, 0);
        store.consume(code, 50_000);
        store.sweep(349_999);
        expect(store.size).toBe(1);
        store.sweep(360_000);
        expect(store.size).toBe(0);
    });
});
