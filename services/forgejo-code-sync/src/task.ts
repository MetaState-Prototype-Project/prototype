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
