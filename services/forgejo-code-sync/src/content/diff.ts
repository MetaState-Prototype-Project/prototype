import type { DiffFetcher, DiffResult } from "../sync.js";
import type { CommitSyncTask } from "../task.js";
import { shouldInline } from "./diffSize.js";

export interface DiffFetcherOptions {
    forgejoApiUrl: string;
    /** PAT on a dedicated site-admin service account - needs read:repository. */
    adminToken: string;
    maxBytes: number;
    fetchImpl?: typeof fetch;
}

/**
 * Builds a `DiffFetcher` that reads a commit's diff from GitW3's own
 * `.diff` route (`routers/web/web.go:1808` - `GET
 * /{owner}/{repo}/commit/{sha}.diff`, confirmed against GitW3's source, gated
 * by `reqRepoCodeReader` so a private repo's diff needs `read:repository` on
 * the token). Never throws - every failure mode (network error, non-2xx
 * response, a diff over the size cap) degrades to the `diffUrl` fallback
 * rather than rejecting, because a fetchable-but-oversized or momentarily
 * unreachable diff should not stop the commit's metadata from being synced.
 * See docs/superpowers/specs/2026-08-14-forgejo-code-sync-design.md
 * ("What gets written").
 */
export function createDiffFetcher(options: DiffFetcherOptions): DiffFetcher {
    const fetchImpl = options.fetchImpl ?? fetch;

    return async function fetchDiff(task: CommitSyncTask): Promise<DiffResult> {
        const fallback: DiffResult = {
            diff: null,
            diffUrl: task.commitUrl || task.compareUrl,
        };

        const url = `${options.forgejoApiUrl}/${task.repoFullName}/commit/${task.commitId}.diff`;

        let res: Response;
        try {
            res = await fetchImpl(url, {
                headers: { Authorization: `token ${options.adminToken}` },
            });
        } catch {
            return fallback;
        }

        if (!res.ok || !res.body) {
            return fallback;
        }

        // Read up to the cap, then stop - no point buffering more of a diff
        // than will ever be inlined, and this is what keeps an oversized or
        // pathological diff from being pulled fully into memory first.
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                total += value.byteLength;
                if (total > options.maxBytes) {
                    await reader.cancel().catch(() => {});
                    return fallback;
                }
            }
        } catch {
            return fallback;
        }

        if (!shouldInline(total, options.maxBytes)) {
            return fallback;
        }

        const diffText = Buffer.concat(
            chunks.map((c) => Buffer.from(c)),
        ).toString("utf8");
        return { diff: diffText, diffUrl: null };
    };
}
