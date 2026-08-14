import type { S3Storage } from "../storage/s3.js";
import type { CommitSyncTask } from "../task.js";

export interface DiffFetcherOptions {
    forgejoApiUrl: string;
    /** PAT on a dedicated site-admin service account - needs read:repository. */
    adminToken: string;
    storage: S3Storage;
    fetchImpl?: typeof fetch;
}

/**
 * Fetches a commit's diff from GitW3 and uploads it to S3, returning the
 * resulting URL - the diff is never inlined into the eVault write itself.
 * See docs/superpowers/specs/2026-08-14-forgejo-code-sync-design.md ("What
 * gets written") for why: eVault's own server has a hard 350MB request-body
 * limit, and a large blob doesn't belong inlined into a graph-database node
 * property even well under that. S3 has no such ceiling.
 *
 * GitW3-verified: the diff is fetched from the **API router**
 * (`GET /api/v1/repos/{owner}/{repo}/git/commits/{sha}.diff`,
 * routers/api/v1/repo/commits.go's `DownloadCommitDiffOrPatch`), not the web
 * router's `GET /{owner}/{repo}/commit/{sha}.diff`. The two look
 * interchangeable but are not: the web-router route never authenticates a
 * PAT for a private repo at all (confirmed empirically - Authorization:
 * token, HTTP Basic, and ?token= all 404 on a private repo, while the exact
 * same request succeeds the moment the repo is made public), so it always
 * failed for private repos regardless of scope. The API-router route is on
 * the standard PAT-aware auth chain and was confirmed working on a live
 * private repo with the same token.
 *
 * Throws on any failure - a fetch error, a non-2xx response, an S3 upload
 * failure - rather than degrading to a link back to GitW3 the way the
 * previous size-capped design did. There is no longer a "couldn't get the
 * diff, but here's a pointer to where you could look" fallback to degrade
 * to: the point of this design is that the diff itself is what gets
 * preserved, so a failure here means the whole commit-sync task retries via
 * the queue's backoff, the same as an eVault write failure - see sync.ts.
 */
export function createDiffFetcher(options: DiffFetcherOptions) {
    const fetchImpl = options.fetchImpl ?? fetch;

    return async function fetchDiff(
        task: CommitSyncTask,
        eName: string,
    ): Promise<string> {
        const url = `${options.forgejoApiUrl}/api/v1/repos/${task.repoFullName}/git/commits/${task.commitId}.diff`;

        const res = await fetchImpl(url, {
            headers: { Authorization: `token ${options.adminToken}` },
        });

        if (!res.ok) {
            throw new Error(
                `fetching diff for ${task.repoFullName}@${task.commitId} failed: HTTP ${res.status}`,
            );
        }

        const diffText = await res.text();

        return options.storage.uploadDiff(
            eName,
            task.repoFullName,
            task.commitId,
            diffText,
            !task.repoPrivate,
        );
    };
}
