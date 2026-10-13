/**
 * The ACL to write on a synced commit's MetaEnvelope, derived from the source
 * repository's visibility on GitW3.
 *
 * `acl: [String!]!` (infrastructure/evault-core/src/core/protocol/typedefs.ts) is
 * a plain string array; `"*"` is special-cased as public everywhere it is checked.
 * Every write anywhere else in this codebase uses `acl: ["*"]` with no exception,
 * except one: infrastructure/evault-core/src/services/BindingDocumentService.ts
 * (`acl: [normalizedSubject]` / `acl: [bindingDocument.subject]`) - a single-entry
 * array holding the subject's own eName. `[eName]` below is modelled on that one
 * real precedent, not invented.
 *
 * KNOWN LIMITATION, confirmed against evault-core's own access-control code, not
 * assumed: "owner-only" here means "not public or anonymously/cross-platform-
 * listable", not "cryptographically restricted to the owner". VaultAccessGuard's
 * checkAccess (the resolver path for a single envelope fetched by ID) grants
 * access to ANY request carrying a valid Registry-issued Bearer token from ANY
 * certified platform, without consulting the envelope's acl in that branch at
 * all - the acl is only actually enforced against an anonymous request (no valid
 * token) or inside the bulk metaEnvelopes list query (filterEnvelopesByAccess),
 * which has no such bypass. So `[eName]` reliably keeps a private-repo commit out
 * of anonymous reach and out of another platform's list-query results, but does
 * NOT stop a different certified platform from reading the same envelope by ID if
 * it already has the ID and the right X-ENAME. That gap is evault-core's existing
 * authorization model, not something this service can fix - see the spec's Trust
 * model. `[eName]` is still strictly better than `["*"]`, and matches the
 * codebase's only precedent for restricted data - just not an airtight guarantee.
 */
export function deriveAcl(repoIsPrivate: boolean, eName: string): string[] {
    return repoIsPrivate ? [eName] : ["*"];
}
