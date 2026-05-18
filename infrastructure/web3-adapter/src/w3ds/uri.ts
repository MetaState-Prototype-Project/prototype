/**
 * The `w3ds://file` URI scheme.
 *
 * A file attached to or described by a Meta Envelope is addressed with:
 *
 *     w3ds://file?id=@<user-ename>/<meta-envelope-id>
 *
 * This module provides helpers to construct, parse and recognise such URIs.
 */

export const W3DS_SCHEME = "w3ds:";
export const W3DS_FILE_HOST = "file";

/**
 * Thrown when a string is not a valid `w3ds://file` URI.
 */
export class InvalidW3dsUriError extends Error {
	constructor(uri: string, reason: string) {
		super(`Invalid w3ds file URI "${uri}": ${reason}`);
		this.name = "InvalidW3dsUriError";
	}
}

export interface FileUriParts {
	/** The owning user's entity name, always `@`-prefixed. */
	ename: string;
	/** The Meta Envelope identifier of the file. */
	metaEnvelopeId: string;
}

/**
 * Builds a `w3ds://file` URI for a file described by a Meta Envelope.
 *
 * @example buildFileUri({ ename: "alice", metaEnvelopeId: "abc123" })
 *   => "w3ds://file?id=@alice/abc123"
 */
export function buildFileUri({ ename, metaEnvelopeId }: FileUriParts): string {
	if (!ename) {
		throw new InvalidW3dsUriError("<build>", "ename is required");
	}
	if (!metaEnvelopeId) {
		throw new InvalidW3dsUriError("<build>", "metaEnvelopeId is required");
	}
	const normalisedEname = ename.startsWith("@") ? ename : `@${ename}`;
	return `${W3DS_SCHEME}//${W3DS_FILE_HOST}?id=${normalisedEname}/${metaEnvelopeId}`;
}

/**
 * Parses a `w3ds://file` URI into its `ename` and `metaEnvelopeId` parts.
 *
 * @throws {InvalidW3dsUriError} when the URI is malformed, uses the wrong
 *   scheme/host, or is missing the `id` query parameter.
 */
export function parseFileUri(uri: string): FileUriParts {
	if (typeof uri !== "string" || uri.trim().length === 0) {
		throw new InvalidW3dsUriError(String(uri), "URI is empty");
	}

	let parsed: URL;
	try {
		parsed = new URL(uri);
	} catch {
		throw new InvalidW3dsUriError(uri, "not a parseable URI");
	}

	if (parsed.protocol !== W3DS_SCHEME) {
		throw new InvalidW3dsUriError(
			uri,
			`expected scheme "${W3DS_SCHEME}//" but got "${parsed.protocol}//"`,
		);
	}

	if (parsed.host !== W3DS_FILE_HOST) {
		throw new InvalidW3dsUriError(
			uri,
			`expected host "${W3DS_FILE_HOST}" but got "${parsed.host}"`,
		);
	}

	const id = parsed.searchParams.get("id");
	if (!id) {
		throw new InvalidW3dsUriError(uri, "missing required `id` query parameter");
	}

	if (!id.startsWith("@")) {
		throw new InvalidW3dsUriError(
			uri,
			"`id` must be in the form @<ename>/<meta-envelope-id>",
		);
	}

	const slashIndex = id.indexOf("/");
	if (slashIndex === -1) {
		throw new InvalidW3dsUriError(
			uri,
			"`id` is missing the `/<meta-envelope-id>` segment",
		);
	}

	const ename = id.slice(0, slashIndex);
	const metaEnvelopeId = id.slice(slashIndex + 1);

	if (ename.length <= 1) {
		throw new InvalidW3dsUriError(uri, "ename is empty");
	}
	if (metaEnvelopeId.length === 0) {
		throw new InvalidW3dsUriError(uri, "meta-envelope-id is empty");
	}

	return { ename, metaEnvelopeId };
}

/**
 * Cheap guard: returns true when `value` looks like a `w3ds://file` URI.
 * Used by the mapper to decide whether a field needs dereferencing.
 */
export function isFileUri(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.startsWith(`${W3DS_SCHEME}//${W3DS_FILE_HOST}`)
	);
}
