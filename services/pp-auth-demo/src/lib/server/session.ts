/**
 * W3DS sign-in, and wallet signing for the owner's terms.
 *
 * Both flows are the same shape: we generate a session identifier, the wallet
 * signs that identifier, and we verify the signature against the registry.
 *
 * For the terms the session identifier *is* the canonical policy payload, so
 * the resulting signature verifies against the statement on its own — anyone
 * holding the record can check it without trusting this app or its session
 * store. That is why the terms are worth signing at all.
 */

import { randomUUID } from "node:crypto";
// The published dist is CommonJS, which rollup cannot statically analyse for
// named exports when bundling for SSR. Same workaround as PPA and enotary.
import { verifySignature } from "signature-validator/src/index";
import { publicUrl, registryUrl } from "./env";

const TTL_MS = 10 * 60_000;

interface Pending {
	createdAt: number;
	kind: "login" | "policy";
	status: "pending" | "done";
	ename?: string;
	signature?: string;
}

/**
 * Anchored outside the module graph: the offer, the wallet's callback and the
 * browser's poll are three separate requests, and Vite's dev SSR can give each
 * its own copy of a module — which silently splits the map, so a signature
 * verifies but the page waiting for it never sees it.
 */
const STORE = Symbol.for("pp-auth-demo.sessions");
const store = globalThis as typeof globalThis & { [STORE]?: Map<string, Pending> };
const sessions: Map<string, Pending> = (store[STORE] ??= new Map());

function sweep(): void {
	const now = Date.now();
	for (const [id, entry] of sessions) {
		if (now - entry.createdAt > TTL_MS) sessions.delete(id);
	}
}

/**
 * Where the wallet should post back.
 *
 * Taken from the request being served, not from configuration. The wallet runs
 * on a phone, so a callback of `localhost` points it at itself and the login
 * silently never completes — and a static env var is wrong the moment the app
 * is reached on a different address than whoever set it had in mind. The
 * origin the browser used is the one address known to reach this app.
 */
function callback(origin: string | undefined, path: string): string {
	return new URL(path, origin || publicUrl()).toString();
}

export function createLoginOffer(origin?: string): { uri: string; session: string } {
	sweep();
	const session = randomUUID();
	sessions.set(session, { createdAt: Date.now(), kind: "login", status: "pending" });
	const redirect = callback(origin, "/api/auth");
	return {
		session,
		uri: `w3ds://auth?redirect=${redirect}&session=${session}&platform=pp-auth-demo`,
	};
}

/**
 * A signing offer whose session id is the payload to be signed. `data` is what
 * the wallet shows the person before they approve it, so it carries the terms
 * in readable form.
 */
export function createSigningOffer(
	payload: string,
	summary: Record<string, unknown>,
	origin?: string,
): { uri: string; session: string } {
	sweep();
	sessions.set(payload, { createdAt: Date.now(), kind: "policy", status: "pending" });
	const redirect = callback(origin, "/api/sign");
	const data = Buffer.from(JSON.stringify(summary), "utf8").toString("base64");
	return {
		session: payload,
		uri: `w3ds://sign?session=${encodeURIComponent(payload)}&data=${encodeURIComponent(data)}&redirect_uri=${encodeURIComponent(redirect)}`,
	};
}

/** Wallet callback for either flow: verify the signature over the session id. */
export async function complete(
	session: string,
	ename: string,
	signature: string,
): Promise<{ ok: boolean; error?: string }> {
	const pending = sessions.get(session);
	if (!pending) return { ok: false, error: "unknown or expired session" };

	const result = await verifySignature({
		eName: ename,
		signature,
		payload: session,
		registryBaseUrl: registryUrl(),
	});
	if (!result.valid) {
		return { ok: false, error: result.error ?? "invalid signature" };
	}

	pending.ename = ename;
	pending.signature = signature;
	pending.status = "done";
	return { ok: true };
}

/**
 * Polled by the page. "unknown" is distinguished from "pending" so an expired
 * or cross-process session tells the page to start again instead of waiting
 * forever.
 */
export function poll(
	session: string,
):
	| { status: "pending" }
	| { status: "unknown" }
	| { status: "done"; ename: string; signature: string } {
	const pending = sessions.get(session);
	if (!pending) return { status: "unknown" };
	if (pending.status === "done" && pending.ename && pending.signature) {
		sessions.delete(session);
		return { status: "done", ename: pending.ename, signature: pending.signature };
	}
	return { status: "pending" };
}
