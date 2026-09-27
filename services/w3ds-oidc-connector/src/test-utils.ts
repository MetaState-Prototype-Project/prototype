import { type AppDeps, createApp, createDeps } from "./app.js";
import { hashClientSecret } from "./clients.js";
import { MemoryClientRepository } from "./clients.memory.js";
import { type Config, loadConfig } from "./config.js";
import { generateSigningJwk, loadSigningKeys } from "./keys.js";

export const ISSUER = "http://localhost:4200";
export const REGISTRY = "http://registry.test";
export const KEYCLOAK_REDIRECT =
    "https://kc.example/realms/main/broker/w3ds/endpoint";
export const RAUTHY_REDIRECT = "https://rauthy.example/auth/v1/providers/callback";
export const SECRET = "s3cret";
/** The eName that owns the two seeded clients. */
export const OPERATOR = "@operator";

export function testConfig(overrides: Partial<Config> = {}): Config {
    return {
        ...loadConfig({
            W3DS_OIDC_ISSUER: ISSUER,
            PUBLIC_REGISTRY_URL: REGISTRY,
            W3DS_OIDC_PLATFORM_NAME: "Test Login",
            W3DS_OIDC_DATABASE_URL: "postgres://unused",
        }),
        ...overrides,
    };
}

/** A repository holding a Keycloak client and a Rauthy (synthetic email) client. */
export async function seededRepository(): Promise<MemoryClientRepository> {
    const repository = new MemoryClientRepository();
    await repository.create({
        clientId: "keycloak",
        secretHash: hashClientSecret(SECRET),
        name: "Keycloak",
        ownerEName: OPERATOR,
        redirectUris: [KEYCLOAK_REDIRECT],
        syntheticEmail: false,
    });
    await repository.create({
        clientId: "rauthy",
        secretHash: hashClientSecret(SECRET),
        name: "Rauthy",
        ownerEName: OPERATOR,
        redirectUris: [RAUTHY_REDIRECT],
        syntheticEmail: true,
    });
    return repository;
}

export async function testApp(
    overrides: Partial<AppDeps> & { repository?: MemoryClientRepository } = {},
) {
    const { repository: given, ...rest } = overrides;
    const repository = given ?? (await seededRepository());
    const config = rest.config ?? testConfig();
    const keys = await loadSigningKeys({
        jwk: JSON.stringify(await generateSigningJwk()),
        production: false,
    });
    const deps = createDeps(config, keys, repository, rest);
    return { deps, repository, app: createApp(deps) };
}

/** Reads server-sent events from a live server until the stream ends. */
export async function readEvents(
    url: string,
    init: RequestInit & { until?: (event: string) => boolean } = {},
): Promise<{ status: number; events: { event: string; data: unknown }[] }> {
    const res = await fetch(url, init);
    const events: { event: string; data: unknown }[] = [];
    if (!res.headers.get("content-type")?.startsWith("text/event-stream")) {
        return { status: res.status, events };
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");
            const event = /^event: (.*)$/m.exec(block)?.[1];
            const data = /^data: (.*)$/m.exec(block)?.[1];
            if (!event) continue;
            events.push({ event, data: data ? JSON.parse(data) : undefined });
            if (init.until?.(event)) {
                await reader.cancel();
                return { status: res.status, events };
            }
        }
    }
    return { status: res.status, events };
}

/** Opens a login via /authorize; returns the session ID and its cookie. */
export async function startLogin(
    agent: { get(url: string): PromiseLike<{ text: string; headers: Record<string, unknown> }> },
    query: string,
): Promise<{ sessionId: string; cookie: string }> {
    const res = await agent.get(`/authorize?${query}`);
    const sessionId = /session=([A-Za-z0-9_-]+)/.exec(res.text)![1];
    const setCookie = res.headers["set-cookie"] as string[];
    return { sessionId, cookie: setCookie[0].split(";")[0] };
}
