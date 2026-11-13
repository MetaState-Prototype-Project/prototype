import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WalletVerifier } from "../app.js";
import { s256 } from "../pkce.js";
import {
    KEYCLOAK_REDIRECT,
    ISSUER,
    readEvents,
    startLogin,
    testApp,
} from "../test-utils.js";

const QUERY = new URLSearchParams({
    client_id: "keycloak",
    redirect_uri: KEYCLOAK_REDIRECT,
    response_type: "code",
    scope: "openid",
    state: "st-1",
    code_challenge: s256("v".repeat(43)),
    code_challenge_method: "S256",
}).toString();

const accept: WalletVerifier = async ({ eName }) => ({
    valid: true,
    eName: eName.startsWith("@") ? eName : `@${eName}`,
    keyType: "software",
});
const reject: WalletVerifier = async () => ({
    valid: false,
    error: "no_valid_certificate",
});

let server: Server | undefined;
afterEach(() => {
    server?.closeAllConnections();
    server?.close();
    server = undefined;
});

async function listen(app: import("express").Express): Promise<string> {
    server = app.listen(0);
    await new Promise((resolve) => server!.once("listening", resolve));
    return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

describe("POST /w3ds/callback", () => {
    it("approves a pending session and never returns the code", async () => {
        const { app, deps } = await testApp({ verifier: accept });
        const { sessionId } = await startLogin(request(app), QUERY);
        const res = await request(app)
            .post("/w3ds/callback")
            .send({ ename: "@alice", session: sessionId, signature: "sig", appVersion: "1.2.0" });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
        const lookup = deps.sessions.lookup(sessionId, deps.now());
        expect(lookup.state === "live" && lookup.session.identity).toMatchObject({
            eName: "@alice",
            amr: ["swk"],
        });
    });

    it("accepts w3id in place of ename", async () => {
        const { app } = await testApp({ verifier: accept });
        const { sessionId } = await startLogin(request(app), QUERY);
        const res = await request(app)
            .post("/w3ds/callback")
            .send({ w3id: "@alice", session: sessionId, signature: "sig" });
        expect(res.status).toBe(200);
    });

    it("rejects conflicting ename and w3id", async () => {
        const { app } = await testApp({ verifier: accept });
        const { sessionId } = await startLogin(request(app), QUERY);
        const res = await request(app)
            .post("/w3ds/callback")
            .send({ ename: "@alice", w3id: "@bob", session: sessionId, signature: "sig" });
        expect(res.status).toBe(400);
    });

    it("maps hardware keys to amr hwk", async () => {
        const { app, deps } = await testApp({
            verifier: async () => ({ valid: true, eName: "@alice", keyType: "hardware" }),
        });
        const { sessionId } = await startLogin(request(app), QUERY);
        await request(app)
            .post("/w3ds/callback")
            .send({ ename: "@alice", session: sessionId, signature: "sig" });
        const lookup = deps.sessions.lookup(sessionId, deps.now());
        expect(lookup.state === "live" && lookup.session.identity?.amr).toEqual(["hwk"]);
    });

    it("returns 401 and leaves the session pending on a bad signature", async () => {
        const verifier = vi.fn(reject);
        const { app, deps } = await testApp({ verifier });
        const { sessionId } = await startLogin(request(app), QUERY);
        const res = await request(app)
            .post("/w3ds/callback")
            .send({ ename: "@alice", session: sessionId, signature: "sig" });
        expect(res.status).toBe(401);
        const lookup = deps.sessions.lookup(sessionId, deps.now());
        expect(lookup.state === "live" && lookup.session.status).toBe("pending");

        verifier.mockImplementation(accept);
        const retry = await request(app)
            .post("/w3ds/callback")
            .send({ ename: "@alice", session: sessionId, signature: "sig" });
        expect(retry.status).toBe(200);
    });

    it("returns 404 for an unknown session without verifying", async () => {
        const verifier = vi.fn(accept);
        const { app } = await testApp({ verifier });
        const res = await request(app)
            .post("/w3ds/callback")
            .send({ ename: "@alice", session: "nope", signature: "sig" });
        expect(res.status).toBe(404);
        expect(verifier).not.toHaveBeenCalled();
    });

    it("returns 410 for an expired session", async () => {
        let now = Date.now();
        const { app } = await testApp({ verifier: accept, now: () => now });
        const { sessionId } = await startLogin(request(app), QUERY);
        now += 301_000;
        const res = await request(app)
            .post("/w3ds/callback")
            .send({ ename: "@alice", session: sessionId, signature: "sig" });
        expect(res.status).toBe(410);
    });

    it("approves only once when two callbacks race", async () => {
        const { app } = await testApp({ verifier: accept });
        const { sessionId } = await startLogin(request(app), QUERY);
        const body = { ename: "@alice", session: sessionId, signature: "sig" };
        const results = await Promise.all([
            request(app).post("/w3ds/callback").send(body),
            request(app).post("/w3ds/callback").send(body),
        ]);
        expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it("answers the wallet's CORS preflight", async () => {
        const { app } = await testApp();
        const res = await request(app)
            .options("/w3ds/callback")
            .set("Origin", "tauri://localhost")
            .set("Access-Control-Request-Method", "POST")
            .set("Access-Control-Request-Headers", "content-type");
        expect(res.status).toBeLessThan(300);
        expect(res.headers["access-control-allow-origin"]).toBe("*");
    });

    it("rejects malformed JSON with 400", async () => {
        const { app } = await testApp();
        const res = await request(app)
            .post("/w3ds/callback")
            .set("Content-Type", "application/json")
            .send("{");
        expect(res.status).toBe(400);
    });

    it("rejects missing fields", async () => {
        const { app } = await testApp({ verifier: accept });
        const res = await request(app).post("/w3ds/callback").send({ ename: "@alice" });
        expect(res.status).toBe(400);
    });
});

describe("GET /w3ds/events/:session", () => {
    it("delivers the code once the wallet signs", async () => {
        const { app } = await testApp({ verifier: accept });
        const base = await listen(app);
        const { sessionId, cookie } = await startLogin(request(app), QUERY);
        const stream = readEvents(`${base}/w3ds/events/${sessionId}`, {
            headers: { cookie },
            until: (e) => e !== "pending",
        });
        await new Promise((r) => setTimeout(r, 50));
        await request(app)
            .post("/w3ds/callback")
            .send({ ename: "@alice", session: sessionId, signature: "sig" });
        const { events } = await stream;
        expect(events.map((e) => e.event)).toEqual(["pending", "approved"]);
        const redirect = new URL((events[1].data as { redirect: string }).redirect);
        expect(`${redirect.origin}${redirect.pathname}`).toBe(KEYCLOAK_REDIRECT);
        expect(redirect.searchParams.get("state")).toBe("st-1");
        expect(redirect.searchParams.get("iss")).toBe(ISSUER);
        expect(redirect.searchParams.get("code")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it("delivers immediately when the wallet signed before the stream opened", async () => {
        const { app } = await testApp({ verifier: accept });
        const base = await listen(app);
        const { sessionId, cookie } = await startLogin(request(app), QUERY);
        await request(app)
            .post("/w3ds/callback")
            .send({ ename: "@alice", session: sessionId, signature: "sig" });
        const { events } = await readEvents(`${base}/w3ds/events/${sessionId}`, {
            headers: { cookie },
        });
        expect(events.map((e) => e.event)).toEqual(["pending", "approved"]);

        const again = await readEvents(`${base}/w3ds/events/${sessionId}`, {
            headers: { cookie },
        });
        expect(again.events).toEqual([{ event: "expired", data: { reason: "used" } }]);
    });

    it("forwards failed attempts without ending the stream", async () => {
        const verifier = vi.fn(reject);
        const { app } = await testApp({ verifier });
        const base = await listen(app);
        const { sessionId, cookie } = await startLogin(request(app), QUERY);
        const stream = readEvents(`${base}/w3ds/events/${sessionId}`, {
            headers: { cookie },
            until: (e) => e === "approved",
        });
        await new Promise((r) => setTimeout(r, 50));
        const body = { ename: "@alice", session: sessionId, signature: "sig" };
        await request(app).post("/w3ds/callback").send(body);
        verifier.mockImplementation(accept);
        await request(app).post("/w3ds/callback").send(body);
        const { events } = await stream;
        expect(events.map((e) => e.event)).toEqual(["pending", "attempt_failed", "approved"]);
    });

    it("refuses a browser without the session cookie", async () => {
        const { app } = await testApp({ verifier: accept });
        const { sessionId } = await startLogin(request(app), QUERY);
        const res = await request(app)
            .get(`/w3ds/events/${sessionId}`)
            .set("Cookie", `w3ds_oidc_${sessionId}=forged`);
        expect(res.status).toBe(403);
        expect(res.headers["content-type"]).toMatch(/text\/plain/);
    });

    it("reports an unknown session as expired", async () => {
        const { app } = await testApp();
        const base = await listen(app);
        const { events } = await readEvents(`${base}/w3ds/events/nope`);
        expect(events).toEqual([{ event: "expired", data: { reason: "expired" } }]);
    });
});

describe("GET /deeplink-login", () => {
    const deeplink = (sessionId: string) =>
        `/deeplink-login?${new URLSearchParams({
            ename: "@alice",
            session: sessionId,
            signature: "sig",
            appVersion: "1.2.0",
        })}`;

    it("redirects straight to the client in the browser that started the login", async () => {
        const { app } = await testApp({ verifier: accept });
        const { sessionId, cookie } = await startLogin(request(app), QUERY);
        const res = await request(app).get(deeplink(sessionId)).set("Cookie", cookie);
        expect(res.status).toBe(303);
        const location = new URL(res.headers.location);
        expect(`${location.origin}${location.pathname}`).toBe(KEYCLOAK_REDIRECT);
        expect(location.searchParams.get("code")).toBeTruthy();
        expect(location.searchParams.get("state")).toBe("st-1");
    });

    it("hands off to the original tab from any other browser", async () => {
        const { app } = await testApp({ verifier: accept });
        const base = await listen(app);
        const { sessionId, cookie } = await startLogin(request(app), QUERY);
        const res = await request(app).get(deeplink(sessionId));
        expect(res.status).toBe(200);
        expect(res.headers.location).toBeUndefined();
        expect(res.text).toContain("Return to the tab where you started");
        const { events } = await readEvents(`${base}/w3ds/events/${sessionId}`, {
            headers: { cookie },
        });
        expect(events.at(-1)?.event).toBe("approved");
    });

    it("shows an error page for a bad signature", async () => {
        const { app } = await testApp({ verifier: reject });
        const { sessionId, cookie } = await startLogin(request(app), QUERY);
        const res = await request(app).get(deeplink(sessionId)).set("Cookie", cookie);
        expect(res.status).toBe(401);
        expect(res.text).toContain("could not be verified");
    });
});
