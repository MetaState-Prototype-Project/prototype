/**
 * The registry, as this demo uses it: entropy for provisioning, eName
 * resolution, and platform certification tokens.
 *
 * `POST /platforms/certification` mints a token for **any** name that asks —
 * there is no authentication on the route and no check that the name means
 * anything. That is the bypass the granular `_acl` model exists to close, and
 * seeing it minted freely is part of what this demo shows.
 *
 * The name matters in one specific way. eVault only treats the token's
 * `platform` claim as a *party* when it is eName-shaped, so a token minted for
 * "acl-demo" authenticates but authorizes as nobody. Every platform in the cast
 * therefore has a real provisioned eName, and that is what goes in the claim.
 */

import { registryUrl } from "./env";

const TOKENS = Symbol.for("acl-demo.platformTokens");
const URLS = Symbol.for("acl-demo.evaultUrls");
const store = globalThis as typeof globalThis & {
	[TOKENS]?: Map<string, Promise<string>>;
	[URLS]?: Map<string, string>;
};
store[TOKENS] ??= new Map();
store[URLS] ??= new Map();

export function normalizeEName(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "";
	return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

/** A signed entropy token, required by the provisioner. */
export async function entropy(): Promise<string> {
	const res = await fetch(new URL("/entropy", registryUrl()), {
		signal: AbortSignal.timeout(15_000),
	});
	if (!res.ok) throw new Error(`registry /entropy returned ${res.status}`);
	const body = (await res.json()) as { token?: string };
	if (!body.token) throw new Error("registry returned no entropy token");
	return body.token;
}

/**
 * A platform Bearer token for one platform eName.
 *
 * Cached per name. A failure is not cached, so the next request tries again.
 */
export async function platformToken(platformEName: string): Promise<string> {
	const name = normalizeEName(platformEName);
	const cached = store[TOKENS]!.get(name);
	if (cached) return cached;

	const pending = (async () => {
		const res = await fetch(new URL("/platforms/certification", registryUrl()), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ platform: name }),
			signal: AbortSignal.timeout(15_000),
		});
		if (!res.ok) throw new Error(`registry token request returned ${res.status}`);
		const body = (await res.json()) as { token?: string };
		if (!body.token) throw new Error("registry returned no token");
		return body.token;
	})().catch((error) => {
		store[TOKENS]!.delete(name);
		throw error;
	});

	store[TOKENS]!.set(name, pending);
	return pending;
}

/** The `platform` claim a token actually carries, read without verifying it. */
export function claimsOf(token: string): Record<string, unknown> | null {
	try {
		const [, payload] = token.split(".");
		if (!payload) return null;
		return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
	} catch {
		return null;
	}
}

/** The eVault URL behind an eName. */
export async function resolveVault(ename: string): Promise<string | null> {
	const normalized = normalizeEName(ename);
	const cached = store[URLS]!.get(normalized);
	if (cached) return cached;
	try {
		const res = await fetch(
			new URL(`/resolve?w3id=${encodeURIComponent(normalized)}`, registryUrl()),
			{ signal: AbortSignal.timeout(15_000) },
		);
		if (!res.ok) return null;
		const body = (await res.json()) as { evaultUrl?: string; uri?: string };
		const url = body.evaultUrl || body.uri;
		if (!url) return null;
		store[URLS]!.set(normalized, url);
		return url;
	} catch {
		return null;
	}
}
