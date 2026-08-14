/**
 * Everything the queue's drain loop needs to sync one commit, captured at
 * webhook-receipt time so the drain loop never has to go back to the original
 * webhook payload (which is not itself persisted - only what's needed is).
 */
export interface CommitSyncTask {
    commitId: string;
    /** "owner/name" */
    repoFullName: string;
    repoPrivate: boolean;
    ref: string;
    /** The pusher's Forgejo username (`pusher.login`) - resolved to an eName in Phase 3. */
    pusherLogin: string;
    message: string;
    /** ISO 8601, from the commit's own timestamp. */
    committedAt: string;
    added: string[];
    removed: string[];
    modified: string[];
    /** This commit's own GitW3 URL - the diffUrl fallback's first choice. */
    commitUrl: string;
    /** The push's compare_url - a fallback if commitUrl is ever unavailable. */
    compareUrl: string;
}

/**
 * Everything the snapshot queue's drain loop needs to sync one push's
 * complete repo state into the OWNER's eVault, captured once per webhook
 * delivery - not once per commit, unlike CommitSyncTask above. A 10-commit
 * push produces exactly one of these, built in webhook/push.ts outside the
 * per-commit loop, using the push's final state (`payload.after`) rather than
 * any individual commit's sha.
 */
export interface RepoSnapshotTask {
    /** "owner/name" */
    repoFullName: string;
    repoPrivate: boolean;
    ref: string;
    /** The repo owner's Forgejo username (`repository.owner.login`) - resolved to an eName the same way a pusher's is. */
    ownerLogin: string;
    /**
     * The push's own `after` field - the sha the ref points at once this push
     * lands, i.e. the exact state the archive endpoint should fetch. Not any
     * individual commit's own id: a multi-commit push has several of those,
     * and only the final one is "the repo's current state".
     */
    headCommitId: string;
}
