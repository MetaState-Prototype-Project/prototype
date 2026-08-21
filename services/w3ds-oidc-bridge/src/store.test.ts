import { beforeEach, describe, expect, it } from "vitest";
import { CODE_TTL_MS, SESSION_TTL_MS, TtlMap, createStore } from "./store.js";

let clock = 0;
const now = () => clock;

beforeEach(() => {
    clock = 1_000_000;
});

describe("TtlMap", () => {
    it("returns a value that is still live", () => {
        const map = new TtlMap<string>(1000, now);
        map.set("k", "v");
        clock += 999;
        expect(map.get("k")).toBe("v");
    });

    it("drops a value the moment its TTL is reached", () => {
        const map = new TtlMap<string>(1000, now);
        map.set("k", "v");
        clock += 1000;
        expect(map.get("k")).toBeUndefined();
    });

    it("forgets an expired entry rather than keeping it around", () => {
        const map = new TtlMap<string>(1000, now);
        map.set("k", "v");
        clock += 1000;
        map.get("k");
        expect(map.size).toBe(0);
    });

    describe("take", () => {
        it("returns the value once and nothing after", () => {
            // This is what makes an authorisation code single-use.
            const map = new TtlMap<string>(1000, now);
            map.set("code", "payload");
            expect(map.take("code")).toBe("payload");
            expect(map.take("code")).toBeUndefined();
        });

        it("returns nothing for an expired entry, and does not leave it behind", () => {
            const map = new TtlMap<string>(1000, now);
            map.set("code", "payload");
            clock += 1000;
            expect(map.take("code")).toBeUndefined();
            expect(map.size).toBe(0);
        });

        it("returns nothing for a key that was never set", () => {
            expect(new TtlMap<string>(1000, now).take("nope")).toBeUndefined();
        });
    });

    describe("update", () => {
        it("replaces a live value and keeps the original expiry", () => {
            // The wallet callback attaches an eName to a session already ticking;
            // answering must not buy the login more time.
            const map = new TtlMap<string>(1000, now);
            map.set("s", "pending");
            clock += 900;
            expect(map.update("s", "authenticated")).toBe(true);
            expect(map.get("s")).toBe("authenticated");
            clock += 100;
            expect(map.get("s")).toBeUndefined();
        });

        it("refuses to revive an expired entry", () => {
            const map = new TtlMap<string>(1000, now);
            map.set("s", "pending");
            clock += 1000;
            expect(map.update("s", "authenticated")).toBe(false);
            expect(map.get("s")).toBeUndefined();
        });

        it("refuses a key that was never set", () => {
            expect(new TtlMap<string>(1000, now).update("nope", "v")).toBe(
                false,
            );
        });
    });

    describe("sweep", () => {
        it("evicts only what has expired", () => {
            const map = new TtlMap<string>(1000, now);
            map.set("old", "a");
            clock += 500;
            map.set("new", "b");
            clock += 500;

            expect(map.sweep()).toBe(1);
            expect(map.get("old")).toBeUndefined();
            expect(map.get("new")).toBe("b");
        });

        it("does nothing when everything is live", () => {
            const map = new TtlMap<string>(1000, now);
            map.set("a", "1");
            map.set("b", "2");
            expect(map.sweep()).toBe(0);
            expect(map.size).toBe(2);
        });
    });
});

describe("createStore", () => {
    it("gives sessions five minutes and codes sixty seconds", () => {
        // The asymmetry is the point: a session waits for a human to scan a QR
        // code, a code only has to survive one redirect.
        expect(SESSION_TTL_MS).toBe(5 * 60 * 1000);
        expect(CODE_TTL_MS).toBe(60 * 1000);

        const store = createStore(now);
        store.sessions.set("s", {
            clientId: "gitw3",
            redirectUri: "u",
            codeChallenge: "c",
        });
        store.codes.set("c", {
            clientId: "gitw3",
            redirectUri: "u",
            codeChallenge: "c",
            ename: "@alice",
        });

        clock += CODE_TTL_MS;
        expect(store.codes.get("c")).toBeUndefined();
        expect(store.sessions.get("s")).toBeDefined();

        clock += SESSION_TTL_MS;
        expect(store.sessions.get("s")).toBeUndefined();
    });

    it("sweeps both maps", () => {
        const store = createStore(now);
        store.sessions.set("s", {
            clientId: "gitw3",
            redirectUri: "u",
            codeChallenge: "c",
        });
        store.codes.set("c", {
            clientId: "gitw3",
            redirectUri: "u",
            codeChallenge: "c",
            ename: "@alice",
        });

        clock += SESSION_TTL_MS;
        store.sweep();

        expect(store.sessions.size).toBe(0);
        expect(store.codes.size).toBe(0);
    });
});
