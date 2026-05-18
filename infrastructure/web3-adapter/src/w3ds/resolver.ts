/**
 * Resolver / dereferencer for the `w3ds://file` URI scheme.
 *
 * - `referenceFile` uploads a file and returns a `w3ds://file` URI for it.
 * - `dereferenceFileUri` takes such a URI and resolves it to the underlying
 *   file's public object-storage URL plus its descriptive metadata.
 */
import type { EVaultClient, UploadFileInput } from "../evault/evault";
import { parseFileUri } from "./uri";

export interface DereferencedFile {
	/** The original `w3ds://file` URI that was dereferenced. */
	uri: string;
	/** The owning user's entity name. */
	ename: string;
	/** The Meta Envelope identifier of the file. */
	metaEnvelopeId: string;
	/** Publicly reachable object-storage URL of the file. */
	publicUrl: string;
	/** Original file name, when recorded. */
	filename?: string;
	/** MIME type, when recorded. */
	contentType?: string;
	/** File size in bytes, when recorded. */
	size?: number;
}

/**
 * Dereferences a `w3ds://file` URI: resolves the owning eVault, fetches the
 * File Meta Envelope and returns the file's public URL and metadata.
 *
 * @throws {InvalidW3dsUriError} when the URI is malformed.
 * @throws {Error} when the eName or Meta Envelope cannot be resolved.
 */
export async function dereferenceFileUri(
	uri: string,
	evaultClient: EVaultClient,
): Promise<DereferencedFile> {
	const { ename, metaEnvelopeId } = parseFileUri(uri);

	let envelope: { data: Record<string, unknown> };
	try {
		envelope = await evaultClient.fetchMetaEnvelope(metaEnvelopeId, ename);
	} catch (error) {
		throw new Error(
			`Unable to dereference "${uri}": could not resolve Meta Envelope ` +
				`${metaEnvelopeId} for ${ename} (${error instanceof Error ? error.message : String(error)})`,
		);
	}

	const data = envelope.data ?? {};
	const publicUrl = data.publicUrl;
	if (typeof publicUrl !== "string" || publicUrl.length === 0) {
		throw new Error(
			`Unable to dereference "${uri}": Meta Envelope ${metaEnvelopeId} is not a file or has no public URL`,
		);
	}

	return {
		uri,
		ename,
		metaEnvelopeId,
		publicUrl,
		filename: typeof data.filename === "string" ? data.filename : undefined,
		contentType:
			typeof data.contentType === "string" ? data.contentType : undefined,
		size: typeof data.size === "number" ? data.size : undefined,
	};
}

/**
 * Uploads a file to the owner eVault's object storage and returns the
 * `w3ds://file` URI that addresses it.
 */
export async function referenceFile(
	evaultClient: EVaultClient,
	ename: string,
	input: UploadFileInput,
): Promise<string> {
	const result = await evaultClient.uploadFile(ename, input);
	return result.uri;
}
