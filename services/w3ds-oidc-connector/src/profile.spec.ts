import { describe, expect, it } from "vitest";
import {
    PROFESSIONAL_PROFILE_ONTOLOGY,
    USER_ONTOLOGY,
    createProfileReader,
    profileFromEnvelopes,
} from "./profile.js";

const ENAME = "@e4d1c2b0-5a6f-4c1e-9b1d-3f2a7c8e9d10";
const REGISTRY = "http://registry.test";
const VAULT = "http://vault.test";

const edges = (...parsed: unknown[]) => ({
    edges: parsed.map((value, i) => ({ node: { id: `m${i}`, parsed: value } })),
});

describe("profileFromEnvelopes", () => {
    it("reads the primary User envelope", () => {
        expect(
            profileFromEnvelopes(ENAME, {
                user: edges(
                    { displayName: "Legacy", email: "old@example.org" },
                    {
                        ename: ENAME,
                        displayName: "Ada Lovelace",
                        givenName: "Ada",
                        familyName: "Lovelace",
                        email: " ada@example.org ",
                    },
                ),
            }),
        ).toEqual({
            email: "ada@example.org",
            name: "Ada Lovelace",
            givenName: "Ada",
            familyName: "Lovelace",
        });
    });

    it("falls back to the professional profile email", () => {
        expect(
            profileFromEnvelopes(ENAME, {
                user: edges({ ename: ENAME, displayName: "Ada" }),
                professional: edges({ email: "work@example.org" }),
            }),
        ).toEqual({ email: "work@example.org", name: "Ada" });
    });

    it("ignores malformed emails and placeholder names", () => {
        expect(
            profileFromEnvelopes(ENAME, {
                user: edges({
                    ename: ENAME,
                    displayName: ENAME,
                    firstName: "Ada",
                    lastName: "L",
                    email: "not an email",
                }),
            }),
        ).toEqual({ name: "Ada L", givenName: "Ada", familyName: "L" });
    });

    it("returns nothing for an empty or missing vault", () => {
        expect(profileFromEnvelopes(ENAME, { user: null })).toEqual({});
        expect(profileFromEnvelopes(ENAME, {})).toEqual({});
    });
});

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

function fakeFetch(handler: Handler) {
    const calls: { url: URL; init: RequestInit }[] = [];
    const impl = (async (input: string | URL, init: RequestInit = {}) => {
        const url = new URL(String(input));
        calls.push({ url, init });
        return handler(url, init);
    }) as typeof fetch;
    return { impl, calls };
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

function upstream(graphql: (auth: string) => Response): Handler {
    let issued = 0;
    return (url, init) => {
        if (url.pathname === "/resolve") return json({ uri: VAULT });
        if (url.pathname === "/platforms/certification") {
            issued += 1;
            return json({ token: `t${issued}` });
        }
        const headers = init.headers as Record<string, string>;
        return graphql(headers.Authorization);
    };
}

const reader = (impl: typeof fetch) =>
    createProfileReader({
        registryUrl: REGISTRY,
        platformName: "Test Login",
        timeoutMs: 1000,
        fetch: impl,
    });

describe("createProfileReader", () => {
    it("queries the owner's vault for both ontologies", async () => {
        const { impl, calls } = fakeFetch(
            upstream(() =>
                json({
                    data: {
                        user: edges({ ename: ENAME, email: "ada@example.org" }),
                        professional: edges(),
                    },
                }),
            ),
        );
        expect(await reader(impl)(ENAME)).toEqual({ email: "ada@example.org" });

        const query = calls.find((c) => c.url.pathname === "/graphql")!;
        expect(query.url.origin).toBe(VAULT);
        expect(query.init.headers).toMatchObject({
            Authorization: "Bearer t1",
            "X-ENAME": ENAME,
        });
        expect(JSON.parse(String(query.init.body)).variables).toEqual({
            user: USER_ONTOLOGY,
            professional: PROFESSIONAL_PROFILE_ONTOLOGY,
        });
        expect(
            calls.find((c) => c.url.pathname === "/resolve")!.url.searchParams.get("w3id"),
        ).toBe(ENAME);
    });

    it("reuses the platform token across logins", async () => {
        const { impl, calls } = fakeFetch(upstream(() => json({ data: {} })));
        const read = reader(impl);
        await read(ENAME);
        await read(ENAME);
        expect(
            calls.filter((c) => c.url.pathname === "/platforms/certification"),
        ).toHaveLength(1);
    });

    it("gets a fresh token once when the eVault refuses one", async () => {
        const { impl } = fakeFetch(
            upstream((auth) =>
                auth === "Bearer t1"
                    ? json({ error: "expired" }, 401)
                    : json({ data: { user: edges({ email: "ada@example.org" }) } }),
            ),
        );
        expect(await reader(impl)(ENAME)).toEqual({ email: "ada@example.org" });
    });

    it("returns an empty profile on any failure", async () => {
        const failing = fakeFetch(() => json({}, 404));
        expect(await reader(failing.impl)(ENAME)).toEqual({});

        const refused = fakeFetch(upstream(() => json({}, 401)));
        expect(await reader(refused.impl)(ENAME)).toEqual({});

        const broken = fakeFetch(() => {
            throw new Error("network down");
        });
        expect(await reader(broken.impl)(ENAME)).toEqual({});
    });

    it("gives up at the deadline", async () => {
        const { impl } = fakeFetch(
            (_url, init) =>
                new Promise((_, reject) => {
                    init.signal?.addEventListener("abort", () =>
                        reject(init.signal?.reason),
                    );
                }),
        );
        const read = createProfileReader({
            registryUrl: REGISTRY,
            platformName: "Test Login",
            timeoutMs: 20,
            fetch: impl,
        });
        expect(await read(ENAME)).toEqual({});
    });
});
