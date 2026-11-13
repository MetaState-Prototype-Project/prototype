import request from "supertest";
import { describe, expect, it } from "vitest";
import { s256 } from "../pkce.js";
import {
    acceptAnyWallet,
    portalSignIn,
    testApp,
    testConfig,
} from "../test-utils.js";

const KC_REDIRECT = "https://kc.alice.example/realms/main/broker/w3ds/endpoint";

/** Reads a copyable value the portal rendered, by its data-field name. */
const field = (html: string, name: string) =>
    new RegExp(`data-field="${name}">([^<]+)<`).exec(html)?.[1];

const basic = (id: string, secret: string) =>
    `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;

async function setup(overrides = {}) {
    const ctx = await testApp({ verifier: acceptAnyWallet, ...overrides });
    const alice = await portalSignIn(ctx.app, "@alice");
    return { ...ctx, alice };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

async function create(
    { app }: Ctx,
    who: { cookie: string; csrf: string },
    fields: Record<string, string> = {},
) {
    const res = await request(app)
        .post("/portal/clients")
        .set("Cookie", who.cookie)
        .type("form")
        .send({
            csrf: who.csrf,
            name: "Alice Corp",
            redirect_uris: KC_REDIRECT,
            ...fields,
        });
    return {
        res,
        clientId: field(res.text, "client-id")!,
        secret: field(res.text, "client-secret")!,
    };
}

describe("developer portal clients", () => {
    it("starts with an empty list", async () => {
        const { app, alice } = await setup();
        const res = await request(app).get("/portal").set("Cookie", alice.cookie);
        expect(res.status).toBe(200);
        expect(res.text).toContain("You have no clients yet");
    });

    it("creates a client and shows its secret once", async () => {
        const ctx = await setup();
        const { res, clientId, secret } = await create(ctx, ctx.alice, {
            synthetic_email: "on",
        });
        expect(res.status).toBe(201);
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(clientId).toMatch(/^w3ds_/);
        expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(res.text).toContain(
            "http://localhost:4200/.well-known/openid-configuration",
        );

        const stored = await ctx.repository.findByClientId(clientId);
        expect(stored).toMatchObject({
            name: "Alice Corp",
            ownerEName: "@alice",
            redirectUris: [KC_REDIRECT],
            syntheticEmail: true,
        });
        expect(stored?.secretHash).not.toContain(secret);

        expect(
            await ctx.deps.clients.authenticate({ authorization: basic(clientId, secret) }),
        ).toMatchObject({ ok: true });

        const list = await request(ctx.app).get("/portal").set("Cookie", ctx.alice.cookie);
        expect(list.text).toContain(clientId);
        expect(list.text).not.toContain(secret);
        const detail = await request(ctx.app)
            .get(`/portal/clients/${clientId}`)
            .set("Cookie", ctx.alice.cookie);
        expect(detail.text).not.toContain(secret);
    });

    it("lets a portal-created client log users in", async () => {
        const ctx = await setup();
        const { clientId } = await create(ctx, ctx.alice);
        const res = await request(ctx.app).get(
            `/authorize?${new URLSearchParams({
                client_id: clientId,
                redirect_uri: KC_REDIRECT,
                response_type: "code",
                scope: "openid",
                code_challenge: s256("v".repeat(43)),
                code_challenge_method: "S256",
            })}`,
        );
        expect(res.status).toBe(200);
        expect(res.text).toContain("Log in to Alice Corp");
    });

    it("shows validation errors and keeps what was typed", async () => {
        const ctx = await setup();
        const { res } = await create(ctx, ctx.alice, {
            name: "Keep me",
            redirect_uris: "http://insecure.example/cb",
        });
        expect(res.status).toBe(400);
        expect(res.text).toContain("must use https");
        expect(res.text).toContain('value="Keep me"');
        expect(res.text).toContain("http://insecure.example/cb");
        expect(await ctx.repository.listByOwner("@alice")).toHaveLength(0);
    });

    it("escapes user-supplied names", async () => {
        const ctx = await setup();
        await create(ctx, ctx.alice, { name: "<script>alert(1)</script>" });
        const list = await request(ctx.app).get("/portal").set("Cookie", ctx.alice.cookie);
        expect(list.text).not.toContain("<script>alert(1)</script>");
        expect(list.text).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    });

    it("limits how many clients an eName creates per hour, deletions included", async () => {
        const ctx = await setup({ config: testConfig({ clientCreateLimit: 2 }) });
        const first = await create(ctx, ctx.alice);
        await create(ctx, ctx.alice);
        await request(ctx.app)
            .post(`/portal/clients/${first.clientId}/delete`)
            .set("Cookie", ctx.alice.cookie)
            .type("form")
            .send({ csrf: ctx.alice.csrf, confirm: "yes" });
        const third = await create(ctx, ctx.alice);
        expect(third.res.status).toBe(429);
        expect(third.res.text).toContain("up to 2 clients an hour");

        const bob = await portalSignIn(ctx.app, "@bob");
        expect((await create(ctx, bob)).res.status).toBe(201);
    });

    it("edits a client", async () => {
        const ctx = await setup();
        const { clientId } = await create(ctx, ctx.alice);
        const res = await request(ctx.app)
            .post(`/portal/clients/${clientId}`)
            .set("Cookie", ctx.alice.cookie)
            .type("form")
            .send({
                csrf: ctx.alice.csrf,
                name: "Renamed",
                redirect_uris: `${KC_REDIRECT}\nhttps://rauthy.alice.example/auth/v1/providers/callback`,
                synthetic_email: "on",
            });
        expect(res.status).toBe(303);
        expect(res.headers.location).toBe(`/portal/clients/${clientId}?saved=1`);
        expect(await ctx.repository.findByClientId(clientId)).toMatchObject({
            name: "Renamed",
            redirectUris: [
                KC_REDIRECT,
                "https://rauthy.alice.example/auth/v1/providers/callback",
            ],
            syntheticEmail: true,
        });
    });

    it("rotates a secret only after confirmation", async () => {
        const ctx = await setup();
        const { clientId, secret } = await create(ctx, ctx.alice);
        const url = `/portal/clients/${clientId}/rotate`;

        const confirm = await request(ctx.app)
            .post(url)
            .set("Cookie", ctx.alice.cookie)
            .type("form")
            .send({ csrf: ctx.alice.csrf });
        expect(confirm.text).toContain("Rotate the client secret?");
        expect(
            await ctx.deps.clients.authenticate({ authorization: basic(clientId, secret) }),
        ).toMatchObject({ ok: true });

        const rotated = await request(ctx.app)
            .post(url)
            .set("Cookie", ctx.alice.cookie)
            .type("form")
            .send({ csrf: ctx.alice.csrf, confirm: "yes" });
        const fresh = field(rotated.text, "client-secret")!;
        expect(fresh).not.toBe(secret);
        expect(
            await ctx.deps.clients.authenticate({ authorization: basic(clientId, secret) }),
        ).toMatchObject({ ok: false });
        expect(
            await ctx.deps.clients.authenticate({ authorization: basic(clientId, fresh) }),
        ).toMatchObject({ ok: true });
    });

    it("deletes a client only after confirmation", async () => {
        const ctx = await setup();
        const { clientId, secret } = await create(ctx, ctx.alice);
        const url = `/portal/clients/${clientId}/delete`;

        const confirm = await request(ctx.app)
            .post(url)
            .set("Cookie", ctx.alice.cookie)
            .type("form")
            .send({ csrf: ctx.alice.csrf });
        expect(confirm.text).toContain("Delete this client?");
        expect(await ctx.repository.findByClientId(clientId)).not.toBeNull();

        const res = await request(ctx.app)
            .post(url)
            .set("Cookie", ctx.alice.cookie)
            .type("form")
            .send({ csrf: ctx.alice.csrf, confirm: "yes" });
        expect(res.status).toBe(303);
        expect(res.headers.location).toBe("/portal?deleted=1");
        expect(
            await ctx.deps.clients.authenticate({ authorization: basic(clientId, secret) }),
        ).toEqual({ ok: false, error: "invalid_client" });
    });

    it("hides every client from everyone but its owner", async () => {
        const ctx = await setup();
        const { clientId } = await create(ctx, ctx.alice);
        const bob = await portalSignIn(ctx.app, "@bob");

        const list = await request(ctx.app).get("/portal").set("Cookie", bob.cookie);
        expect(list.text).not.toContain(clientId);
        expect(
            (await request(ctx.app).get(`/portal/clients/${clientId}`).set("Cookie", bob.cookie))
                .status,
        ).toBe(404);
        for (const [path, body] of [
            [`/portal/clients/${clientId}`, { name: "x", redirect_uris: KC_REDIRECT }],
            [`/portal/clients/${clientId}/rotate`, { confirm: "yes" }],
            [`/portal/clients/${clientId}/delete`, { confirm: "yes" }],
        ] as const) {
            const res = await request(ctx.app)
                .post(path)
                .set("Cookie", bob.cookie)
                .type("form")
                .send({ csrf: bob.csrf, ...body });
            expect(res.status).toBe(404);
        }
        expect(await ctx.repository.findByClientId(clientId)).toMatchObject({
            name: "Alice Corp",
            ownerEName: "@alice",
        });
    });

    it("refuses form posts without the session's CSRF token", async () => {
        const ctx = await setup();
        const res = await request(ctx.app)
            .post("/portal/clients")
            .set("Cookie", ctx.alice.cookie)
            .type("form")
            .send({ name: "x", redirect_uris: KC_REDIRECT });
        expect(res.status).toBe(403);
        const bob = await portalSignIn(ctx.app, "@bob");
        const stolen = await request(ctx.app)
            .post("/portal/clients")
            .set("Cookie", ctx.alice.cookie)
            .type("form")
            .send({ csrf: bob.csrf, name: "x", redirect_uris: KC_REDIRECT });
        expect(stolen.status).toBe(403);
        expect(await ctx.repository.listByOwner("@alice")).toHaveLength(0);
    });

    it("accepts form posts carrying the browser's Origin header", async () => {
        const ctx = await setup();
        const post = (host: string, origin: string) =>
            request(ctx.app)
                .post("/portal/clients")
                .set("Host", host)
                .set("Origin", origin)
                .set("Cookie", ctx.alice.cookie)
                .type("form")
                .send({ csrf: ctx.alice.csrf, name: "x", redirect_uris: KC_REDIRECT });

        // The public issuer, and the host the browser actually used.
        expect((await post("192.168.0.235:4200", "http://localhost:4200")).status).toBe(201);
        expect((await post("192.168.0.235:4200", "http://192.168.0.235:4200")).status).toBe(201);
        // Opaque and foreign origins are refused.
        expect((await post("localhost:4200", "null")).status).toBe(403);
        expect((await post("localhost:4200", "https://evil.example")).status).toBe(403);
    });

    it("lets portal pages send their origin with form posts", async () => {
        const ctx = await setup();
        const res = await request(ctx.app).get("/portal").set("Cookie", ctx.alice.cookie);
        expect(res.headers["referrer-policy"]).toBe("same-origin");
        expect(res.text).toContain('<meta name="referrer" content="same-origin">');
        const login = await request(ctx.app).get("/portal/login");
        expect(login.headers["referrer-policy"]).toBe("no-referrer");
    });

    it("offers every credential and connection value with a copy button", async () => {
        const ctx = await setup();
        const { res, clientId, secret } = await create(ctx, ctx.alice);
        for (const value of [
            clientId,
            secret,
            "http://localhost:4200/.well-known/openid-configuration",
            "http://localhost:4200/token",
            "http://localhost:4200/jwks",
        ]) {
            expect(res.text).toContain(`data-copy="${value}"`);
        }
        const detail = await request(ctx.app)
            .get(`/portal/clients/${clientId}`)
            .set("Cookie", ctx.alice.cookie);
        expect(detail.text).toContain(`data-copy="${clientId}"`);
        expect(detail.text).toContain(`data-copy="${KC_REDIRECT}"`);
        expect(detail.text).not.toContain(secret);
    });

    it("stays provider-neutral and links to the provider guides", async () => {
        const ctx = await setup();
        const { res, clientId } = await create(ctx, ctx.alice);
        const pages = [
            res.text,
            (await request(ctx.app).get("/portal").set("Cookie", ctx.alice.cookie)).text,
            (await request(ctx.app).get("/portal/clients/new").set("Cookie", ctx.alice.cookie)).text,
            (await request(ctx.app).get(`/portal/clients/${clientId}`).set("Cookie", ctx.alice.cookie)).text,
        ];
        for (const html of pages) {
            expect(html).not.toMatch(/keycloak|rauthy/i);
        }
        expect(res.text).toContain(
            "https://docs.w3ds.metastate.foundation/docs/Services/OIDC-Provider-Guides",
        );
    });

    it("shows breadcrumbs back to the client list", async () => {
        const ctx = await setup();
        const { clientId } = await create(ctx, ctx.alice);
        const detail = await request(ctx.app)
            .get(`/portal/clients/${clientId}`)
            .set("Cookie", ctx.alice.cookie);
        expect(detail.text).toContain('<li><a href="/portal">Clients</a></li>');
        expect(detail.text).toContain('<li aria-current="page">Alice Corp</li>');
    });

    it("stores a logo and shows it in the list and on the client", async () => {
        const ctx = await setup();
        const logo = "https://cdn.alice.example/logo.png";
        const { res, clientId } = await create(ctx, ctx.alice, { logo_url: logo });
        expect(res.status).toBe(201);
        expect((await ctx.repository.findByClientId(clientId))?.logoUrl).toBe(logo);
        const list = await request(ctx.app).get("/portal").set("Cookie", ctx.alice.cookie);
        expect(list.text).toContain(`<img class="avatar sm" src="${logo}"`);
        const detail = await request(ctx.app)
            .get(`/portal/clients/${clientId}`)
            .set("Cookie", ctx.alice.cookie);
        expect(detail.text).toContain(`data-copy="${logo}"`);
        expect(detail.headers["content-security-policy"]).toContain("img-src 'self' data: https:");

        await request(ctx.app)
            .post(`/portal/clients/${clientId}`)
            .set("Cookie", ctx.alice.cookie)
            .type("form")
            .send({ csrf: ctx.alice.csrf, name: "Alice Corp", redirect_uris: KC_REDIRECT, logo_url: "" });
        expect((await ctx.repository.findByClientId(clientId))?.logoUrl).toBeNull();
    });

    it("rejects a logo that is not https", async () => {
        const ctx = await setup();
        const { res } = await create(ctx, ctx.alice, { logo_url: "http://cdn.alice.example/logo.png" });
        expect(res.status).toBe(400);
        expect(res.text).toContain("The logo URL must use https");
        expect(res.text).toContain('value="http://cdn.alice.example/logo.png"');
    });

    it("sends the bare URL to the portal", async () => {
        const { app } = await testApp();
        const res = await request(app).get("/");
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/portal");
    });
});
