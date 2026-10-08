/**
 * Verifies a signature made for a company under a delegation.
 *
 * The company's eVault is a plain store and enforces nothing, so authority is
 * decided here: the delegate's signature over the `w3ds-sign/v1` payload, then
 * the board and the delegation chain read from the eVault's version history,
 * each link checked against its signer's grant (`@metastate-foundation/delegation`).
 */

import {
	checkDelegatedSignature,
	type DelegatedSignPayload,
	evaluateFromHistory,
	type HistorySource,
	parseDelegatedSignPayload,
	type Version,
} from "@metastate-foundation/delegation";
import { normalizeEName, verifyEnameSignature } from "./ename-signature.js";

export type DelegatedSignatureError =
	| "invalid_payload"
	| "bad_signature"
	| "resolve_failed"
	| "not_a_company"
	| "history_failed"
	| "chain_invalid"
	| "not_covered"
	| "timeout";

export interface VerifyDelegatedSignatureOptions {
	/** The exact string the wallet signed: a `w3ds-sign/v1` payload. */
	payload: string;
	signature: string;
	registryBaseUrl: string;
	/** A token the company's eVault accepts for reading history, e.g. a platform token. */
	platformToken: string;
	/** Applied to each Registry and eVault call. Defaults to 5000 ms. */
	timeoutMs?: number;
	fetch?: typeof fetch;
	signal?: AbortSignal;
	/** The moment to judge validity at. Defaults to now. */
	now?: Date;
}

export interface VerifyDelegatedSignatureResult {
	valid: boolean;
	error?: DelegatedSignatureError;
	/** The underlying reason, e.g. the chain failure code. */
	detail?: string;
	payload?: DelegatedSignPayload;
	companyEName?: string;
	title?: string;
	scopes?: string[];
	/** Every link's app limits, root first; the platform must satisfy all. */
	appLimits?: Record<string, unknown>[];
	/** Delegation ids from the one used up to its role assignment. */
	chain?: string[];
}

const DEFAULT_TIMEOUT_MS = 5000;
const HISTORY_PAGE = 100;
/** Bounds how much history one record may make us read. */
const MAX_HISTORY_PAGES = 20;

const HISTORY_QUERY = `query History($id: ID!, $first: Int, $after: String) {
	metaEnvelopeHistory(id: $id, first: $first, after: $after) {
		edges { node { version operation ontology parsed createdAt } }
		pageInfo { hasNextPage endCursor }
	}
}`;

class Failure extends Error {
	constructor(
		readonly code: DelegatedSignatureError,
		readonly detail?: string,
	) {
		super(code);
	}
}

/**
 * Verifies that the payload's signer signed it and that a live delegation in
 * the named company's eVault covers its scope. Never throws.
 */
export async function verifyDelegatedSignature(
	options: VerifyDelegatedSignatureOptions,
): Promise<VerifyDelegatedSignatureResult> {
	const payload =
		typeof options.payload === "string"
			? parseDelegatedSignPayload(options.payload)
			: null;
	if (!payload) return { valid: false, error: "invalid_payload" };

	const request = {
		timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
		fetch: options.fetch ?? globalThis.fetch,
		signal: options.signal,
	};
	const ename = (eName: string, signedPayload: string, signature: string) =>
		verifyEnameSignature({
			eName,
			payload: signedPayload,
			signature,
			registryBaseUrl: options.registryBaseUrl,
			...request,
		});

	try {
		const signed = await ename(payload.signer, options.payload, options.signature);
		if (!signed.valid) throw new Failure("bad_signature", signed.error);

		const company = normalizeEName(payload.onBehalfOf);
		const evault = await resolveEVault(company, options.registryBaseUrl, request);
		const companyId = await companyRecordId(company, evault, request);

		// One verification may check the same grant more than once.
		const checked = new Map<string, Promise<boolean>>();
		const verify = (eName: string, signedPayload: string, signature: string) => {
			const key = JSON.stringify([eName, signedPayload, signature]);
			if (!checked.has(key)) {
				checked.set(
					key,
					ename(eName, signedPayload, signature).then((r) => r.valid),
				);
			}
			return checked.get(key) as Promise<boolean>;
		};

		const chain = await evaluateFromHistory({
			delegationId: payload.delegationId,
			companyEName: company,
			companyId,
			source: historySource(company, evault, options.platformToken, request),
			verify,
			now: options.now,
		});
		const problem = checkDelegatedSignature(payload, chain);
		if (problem) {
			throw problem.code === "CHAIN_INVALID"
				? new Failure("chain_invalid", problem.chain.code)
				: new Failure("not_covered", problem.code);
		}
		if (!chain.ok) throw new Failure("chain_invalid");

		return {
			valid: true,
			payload,
			companyEName: company,
			title: chain.title,
			scopes: chain.scopes,
			appLimits: chain.appLimits,
			chain: chain.chain,
		};
	} catch (error) {
		if (error instanceof Failure) {
			return { valid: false, error: error.code, detail: error.detail, payload };
		}
		return {
			valid: false,
			error: isTimeout(error) ? "timeout" : "history_failed",
			payload,
		};
	}
}

type Request = {
	timeoutMs: number;
	fetch: typeof fetch;
	signal?: AbortSignal;
};

async function call(
	url: URL,
	request: Request,
	failure: DelegatedSignatureError,
	init: RequestInit = {},
): Promise<unknown> {
	const signals = [AbortSignal.timeout(request.timeoutMs)];
	if (request.signal) signals.push(request.signal);
	try {
		const response = await request.fetch(url, {
			...init,
			headers: { accept: "application/json", ...(init.headers ?? {}) },
			signal: AbortSignal.any(signals),
			redirect: "error",
			cache: "no-store",
		});
		if (!response.ok) throw new Failure(failure);
		return await response.json();
	} catch (error) {
		if (error instanceof Failure) throw error;
		if (isTimeout(error)) throw new Failure("timeout");
		throw new Failure(failure);
	}
}

async function resolveEVault(
	eName: string,
	registryBaseUrl: string,
	request: Request,
): Promise<URL> {
	const url = new URL("/resolve", registryBaseUrl);
	url.searchParams.set("w3id", eName);
	const resolved = (await call(url, request, "resolve_failed")) as {
		kind?: unknown;
		uri?: unknown;
	} | null;
	if (resolved?.kind !== "evault" || typeof resolved.uri !== "string") {
		throw new Failure("resolve_failed");
	}
	try {
		const uri = new URL(resolved.uri);
		if (uri.protocol !== "http:" && uri.protocol !== "https:") throw new Error();
		return uri;
	} catch {
		throw new Failure("resolve_failed");
	}
}

/** The company's own Company record: the eVault's pinned manifest. */
async function companyRecordId(
	eName: string,
	evault: URL,
	request: Request,
): Promise<string> {
	const whois = (await call(new URL("/whois", evault), request, "not_a_company", {
		headers: { "X-ENAME": eName },
	})) as { type?: unknown; manifest?: { id?: unknown } | null } | null;
	if (whois?.type !== "company" || typeof whois.manifest?.id !== "string") {
		throw new Failure("not_a_company");
	}
	return whois.manifest.id;
}

function historySource(
	eName: string,
	evault: URL,
	token: string,
	request: Request,
): HistorySource {
	return {
		async versions(id) {
			const newestFirst: Version[] = [];
			let after: string | null = null;
			for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
				const body = (await call(new URL("/graphql", evault), request, "history_failed", {
					method: "POST",
					headers: {
						"content-type": "application/json",
						"X-ENAME": eName,
						authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						query: HISTORY_QUERY,
						variables: { id, first: HISTORY_PAGE, after },
					}),
				})) as {
					data?: {
						metaEnvelopeHistory?: {
							edges?: { node?: Version }[];
							pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
						} | null;
					};
					errors?: unknown[];
				} | null;
				if (body?.errors?.length) throw new Failure("history_failed");
				const connection = body?.data?.metaEnvelopeHistory;
				// A record the eVault has never seen has no history.
				if (!connection) return [];
				for (const edge of connection.edges ?? []) {
					if (edge?.node) newestFirst.push(edge.node);
				}
				if (!connection.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) {
					return newestFirst.reverse();
				}
				after = connection.pageInfo.endCursor;
			}
			throw new Failure("history_failed", "history too long");
		},
	};
}

function isTimeout(error: unknown): boolean {
	return (
		error instanceof Error &&
		(error.name === "TimeoutError" || error.name === "AbortError")
	);
}
