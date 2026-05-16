/**
 * Schema ID (ontology) used for File meta-envelopes created by the uploadFile
 * mutation. Stable so that the dereference endpoint can recognise file records.
 */
export const FILE_SCHEMA_ID = "w3ds-file-v1";

/**
 * Builds a `w3ds://file` URI that uniquely addresses a file meta-envelope.
 *
 * @example buildFileUri("@alice", "abc123")
 *   => "w3ds://file?id=@alice/abc123"
 */
export function buildFileUri(eName: string, metaEnvelopeId: string): string {
    const ename = eName.startsWith("@") ? eName : `@${eName}`;
    return `w3ds://file?id=${ename}/${metaEnvelopeId}`;
}
