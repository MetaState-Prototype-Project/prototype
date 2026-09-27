import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import type { WalletVerifier } from "../app.js";
import { readEvents, testApp } from "../test-utils.js";

const accept: WalletVerifier = async () => ({
    valid: true,
    eName: "@alice",
    keyType: "software",
});

let server: Server | undefined;
afterEach(() => {
    server?.closeAllConnections();
    server?.close();
    server = undefined;
});

async function listen(app: Express): Promise<string> {
    server = app.listen(0);
    await new Promise((resolve) => server!.once("listening", resolve));
    return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

function cookieValue(setCookie: string[] | undefined, prefix: string) {
    return setCookie?.find((c) => c.startsWith(prefix))?.split(";")[0];
}

/** Opens the portal QR page and has the wallet sign it. */
async function openAndSign(app: Express) {
    const page = await request(app).get("/portal/login");
    expect(page.status).toBe(200);
    expect(page.text).toContain("Sign in to the developer portal");
    const sessionId = /session=([A-Za-z0-9_-]+)/.exec(page.text)![1];
    const binding = cookieValue(page.headers["set-cookie"] as unknown as string[], "w3ds_oidc_")!;
    const signed = await request(app)
        .post("/w3ds/callback")
        .send({ ename: "@alice", session: sessionId, signature: "sig" });
    expect(signed.status).toBe(200);
    return { sessionId, binding };
}

/** Runs a whole portal login and returns the portal session cookie. */
async function signIn(app: Express): Promise<string> {
    const { sessionId, binding } = await openAndSign(app);
    const done = await request(app)
        .get(`/portal/login/complete?session=${sessionId}`)
        .set("Cookie", binding);
    expect(done.status).toBe(303);
    return cookieValue(done.headers["set-cookie"] as unknown as string[], "w3ds_portal=")!;
}

describe("developer portal login", () => {
    it("sends anonymous visitors to the login page", async () => {
        const { app } = await testApp();
        const res = await request(app).get("/portal");
        expect(res.status).toBe(303);
        expect(res.headers.location).toBe("/portal/login");
    });

    it("hands the browser to the completion URL over the event stream", async () => {
        const { app } = await testApp({ verifier: accept });
        const base = await listen(app);
        const { sessionId, binding } = await openAndSign(app);
        const { events } = await readEvents(`${base}/w3ds/events/${sessionId}`, {
            headers: { cookie: binding },
        });
        expect(events.at(-1)).toEqual({
            event: "approved",
            data: { redirect: `/portal/login/complete?session=${sessionId}` },
        });
    });

    it("signs the browser in once the wallet has signed", async () => {
        const { app } = await testApp({ verifier: accept });
        const { sessionId, binding } = await openAndSign(app);
        const done = await request(app)
            .get(`/portal/login/complete?session=${sessionId}`)
            .set("Cookie", binding);
        expect(done.status).toBe(303);
        expect(done.headers.location).toBe("/portal");
        const cookies = done.headers["set-cookie"] as unknown as string[];
        const portal = cookies.find((c) => c.startsWith("w3ds_portal="))!;
        expect(portal).toMatch(/HttpOnly/);
        expect(portal).toMatch(/SameSite=Strict/);

        const home = await request(app)
            .get("/portal")
            .set("Cookie", portal.split(";")[0]);
        expect(home.status).toBe(200);
        expect(home.text).toContain("@alice");
    });

    it("refuses to complete in a browser that did not open the QR code", async () => {
        const { app } = await testApp({ verifier: accept });
        const { sessionId } = await openAndSign(app);
        const res = await request(app)
            .get(`/portal/login/complete?session=${sessionId}`)
            .set("Cookie", `w3ds_oidc_${sessionId}=forged`);
        expect(res.status).toBe(400);
        expect(res.headers["set-cookie"]?.toString() ?? "").not.toContain("w3ds_portal=");
    });

    it("refuses to complete before the wallet signs", async () => {
        const { app } = await testApp({ verifier: accept });
        const page = await request(app).get("/portal/login");
        const sessionId = /session=([A-Za-z0-9_-]+)/.exec(page.text)![1];
        const binding = cookieValue(page.headers["set-cookie"] as unknown as string[], "w3ds_oidc_")!;
        const res = await request(app)
            .get(`/portal/login/complete?session=${sessionId}`)
            .set("Cookie", binding);
        expect(res.status).toBe(400);
    });

    it("completes a sign-in only once", async () => {
        const { app } = await testApp({ verifier: accept });
        const { sessionId, binding } = await openAndSign(app);
        const url = `/portal/login/complete?session=${sessionId}`;
        expect((await request(app).get(url).set("Cookie", binding)).status).toBe(303);
        expect((await request(app).get(url).set("Cookie", binding)).status).toBe(400);
    });

    it("never turns a portal login into an IdP code", async () => {
        const { app, deps } = await testApp({ verifier: accept });
        const { sessionId, binding } = await openAndSign(app);
        const deeplink = await request(app)
            .get(`/deeplink-login?ename=@alice&session=${sessionId}&signature=sig`)
            .set("Cookie", binding);
        expect(deeplink.status).toBe(409);
        expect(deps.codes.size).toBe(0);
    });

    it("completes a mobile deep-link sign-in in the same browser", async () => {
        const { app } = await testApp({ verifier: accept });
        const page = await request(app).get("/portal/login");
        const sessionId = /session=([A-Za-z0-9_-]+)/.exec(page.text)![1];
        const binding = cookieValue(page.headers["set-cookie"] as unknown as string[], "w3ds_oidc_")!;
        const res = await request(app)
            .get(`/deeplink-login?ename=@alice&session=${sessionId}&signature=sig`)
            .set("Cookie", binding);
        expect(res.status).toBe(303);
        expect(res.headers.location).toBe(`/portal/login/complete?session=${sessionId}`);
    });

    it("ignores a tampered or expired session cookie", async () => {
        let now = Date.now();
        const { app } = await testApp({ verifier: accept, now: () => now });
        const cookie = await signIn(app);
        const tampered = `${cookie.slice(0, -4)}AAAA`;
        expect((await request(app).get("/portal").set("Cookie", tampered)).status).toBe(303);
        expect((await request(app).get("/portal").set("Cookie", cookie)).status).toBe(200);
        now += 8 * 60 * 60 * 1000 + 1000;
        expect((await request(app).get("/portal").set("Cookie", cookie)).status).toBe(303);
    });

    it("does not accept a session cookie signed by another deployment", async () => {
        const one = await testApp({ verifier: accept });
        const two = await testApp({ verifier: accept });
        const cookie = await signIn(one.app);
        expect((await request(two.app).get("/portal").set("Cookie", cookie)).status).toBe(303);
    });

    it("signs out only with the session's CSRF token", async () => {
        const { app } = await testApp({ verifier: accept });
        const cookie = await signIn(app);
        const home = await request(app).get("/portal").set("Cookie", cookie);
        const csrf = /name="csrf" value="([^"]+)"/.exec(home.text)![1];

        const forged = await request(app)
            .post("/portal/logout")
            .set("Cookie", cookie)
            .type("form")
            .send({ csrf: "wrong" });
        expect(forged.status).toBe(403);

        const crossOrigin = await request(app)
            .post("/portal/logout")
            .set("Cookie", cookie)
            .set("Origin", "https://evil.example")
            .type("form")
            .send({ csrf });
        expect(crossOrigin.status).toBe(403);

        const res = await request(app)
            .post("/portal/logout")
            .set("Cookie", cookie)
            .type("form")
            .send({ csrf });
        expect(res.status).toBe(303);
        expect((res.headers["set-cookie"] as unknown as string[])[0]).toMatch(
            /^w3ds_portal=;.*Max-Age=0/,
        );
    });

    it("lets portal pages submit forms only to this origin", async () => {
        const { app } = await testApp({ verifier: accept });
        const cookie = await signIn(app);
        const home = await request(app).get("/portal").set("Cookie", cookie);
        expect(home.headers["content-security-policy"]).toContain("form-action 'self'");
        const login = await request(app).get("/portal/login");
        expect(login.headers["content-security-policy"]).toContain("form-action 'none'");
    });
});
