import type { S3Storage } from "../storage/s3.js";
import type { RepoSnapshotTask } from "../task.js";

export interface ArchiveFetcherOptions {
    forgejoApiUrl: string;
    /** PAT on a dedicated site-admin service account - needs read:repository, same token content/diff.ts uses. */
    adminToken: string;
    storage: S3Storage;
    fetchImpl?: typeof fetch;
}

/**
 * Fetches a full repo archive from GitW3 at the push's final ref state and
 * uploads it to S3, returning the resulting URL - never inlined, same
 * reasoning as content/diff.ts, and doubly true here since a whole repo is
 * routinely far larger than a single diff.
 *
 * GitW3-verified live, not assumed from source alone, per the same discipline
 * that caught the web-router `.diff` route's private-repo auth bug: curled
 * `GET /api/v1/repos/{owner}/{repo}/archive/{sha}.zip` directly against a
 * live private test repo. `Authorization: token <admin token>` -> `200` with
 * a real zip archive containing the repo's actual files; the identical
 * request with no `Authorization` header -> `404` (Forgejo's usual
 * anonymous-request-on-a-private-repo response, not `403`, so as not to leak
 * that the repo exists). Confirmed with a real commit sha as the ref, not
 * just a branch name, since that's what the once-per-push snapshot task
 * always has (`RepoSnapshotTask.headCommitId`, the push payload's own
 * `after`).
 *
 * Source confirms this is on the same PAT-aware auth chain as the working
 * `.diff` route, not the broken one: `routers/api/v1/api.go`'s
 * `m.Get("/archive/*", reqRepoReader(unit.TypeCode), repo.GetArchive)`,
 * mounted under `/api/v1/repos/{username}/{reponame}` - the API router, never
 * the web router's own separate `/archive` group in `routers/web/web.go`,
 * which is not used here at all.
 *
 * Throws on any failure - a fetch error, a non-2xx response, an S3 upload
 * failure - same discipline as content/diff.ts: there is no degraded
 * fallback to fall back to, so a failure here means the whole snapshot task
 * retries via the snapshot queue's own backoff.
 */
export function createArchiveFetcher(options: ArchiveFetcherOptions) {
    const fetchImpl = options.fetchImpl ?? fetch;

    return async function fetchArchive(
        task: RepoSnapshotTask,
    ): Promise<string> {
        const url = `${options.forgejoApiUrl}/api/v1/repos/${task.repoFullName}/archive/${task.headCommitId}.zip`;

        const res = await fetchImpl(url, {
            headers: { Authorization: `token ${options.adminToken}` },
        });

        if (!res.ok) {
            throw new Error(
                `fetching archive for ${task.repoFullName}@${task.headCommitId} failed: HTTP ${res.status}`,
            );
        }

        const archiveBytes = Buffer.from(await res.arrayBuffer());

        return options.storage.uploadRepoArchive(
            task.repoFullName,
            archiveBytes,
            !task.repoPrivate,
        );
    };
}
