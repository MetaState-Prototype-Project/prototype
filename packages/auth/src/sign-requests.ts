/**
 * Builds `w3ds://sign` requests for company delegation. The eID wallet signs
 * the `session` string as-is, so the signed payload *is* the session; the
 * wallet needs no changes and the platform rejects what no delegation covers.
 */

import {
	buildDelegatedSignPayload,
	buildGrantPayload,
	type DelegatedSignPayload,
} from "@metastate-foundation/delegation";
import { normalizeEName } from "./ename-signature.js";

export interface SignRequest {
	/** The `w3ds://sign` URI to show as a QR code or deep link. */
	uri: string;
	/** The exact string the wallet will sign (also the `session`). */
	payload: string;
}

export interface DelegatedSignRequestOptions
	extends Omit<DelegatedSignPayload, "issuedAt"> {
	/** Where the wallet POSTs the signature. */
	redirectUri: string;
	platformUrl?: string;
	/** The delegate's title, shown in the wallet. */
	title: string;
	/** The company's display name; defaults to its eName. */
	companyName?: string;
	issuedAt?: string;
}

/** A request for a delegate to sign for a company. */
export function buildDelegatedSignRequest(
	options: DelegatedSignRequestOptions,
): SignRequest {
	const payload = buildDelegatedSignPayload({
		// The verifier compares these as eNames, so they carry their `@`.
		onBehalfOf: normalizeEName(options.onBehalfOf),
		signer: normalizeEName(options.signer),
		scope: options.scope,
		delegationId: options.delegationId,
		documentHash: options.documentHash,
		session: options.session,
		issuedAt: options.issuedAt ?? new Date().toISOString(),
	});
	const message = `Signing as ${options.title} for ${options.companyName ?? normalizeEName(options.onBehalfOf)}`;
	return {
		payload,
		uri: signUri(payload, message, options.redirectUri, options.platformUrl),
	};
}

export interface GrantSignRequestOptions {
	ontology: string;
	companyEName: string;
	/** The MetaEnvelope id the record will be written under. */
	recordId: string;
	signerEName: string;
	/** The record as it will be stored, without `authorization`. */
	record: Record<string, unknown>;
	redirectUri: string;
	platformUrl?: string;
	/** What the signer is approving, shown in the wallet. */
	message: string;
	signedAt?: string;
}

/**
 * A request for a director or delegate to authorise a Company, Role,
 * Delegation or Shareholding record. Once the signature arrives, store the
 * record with `authorization: { signerEName, signedPayload: payload,
 * signature, signedAt }` under `recordId`, using the returned (normalised)
 * `signerEName` and `signedAt`.
 */
export async function buildGrantSignRequest(
	options: GrantSignRequestOptions,
): Promise<SignRequest & { signedAt: string; signerEName: string }> {
	const signedAt = options.signedAt ?? new Date().toISOString();
	const signerEName = normalizeEName(options.signerEName);
	const payload = await buildGrantPayload({
		ontology: options.ontology,
		companyEName: normalizeEName(options.companyEName),
		recordId: options.recordId,
		signerEName,
		signedAt,
		record: options.record,
	});
	return {
		payload,
		signedAt,
		signerEName,
		uri: signUri(payload, options.message, options.redirectUri, options.platformUrl),
	};
}

function signUri(
	session: string,
	message: string,
	redirectUri: string,
	platformUrl?: string,
): string {
	const params = new URLSearchParams({
		session,
		data: base64Json({ message, sessionId: session }),
		redirect_uri: redirectUri,
	});
	if (platformUrl) params.set("platform_url", platformUrl);
	return `w3ds://sign?${params.toString()}`;
}

/**
 * The wallet decodes `data` with `atob`, which yields bytes, not UTF-8 text.
 * Escaping non-ASCII characters keeps the JSON pure ASCII so names survive.
 */
function base64Json(value: unknown): string {
	const ascii = JSON.stringify(value).replace(
		/[\u0080-￿]/g,
		(c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
	);
	return Buffer.from(ascii, "ascii").toString("base64");
}
