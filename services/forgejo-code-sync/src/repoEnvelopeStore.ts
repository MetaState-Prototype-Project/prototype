import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Durable `repoFullName -> envelopeId` mapping, so a later push can find the
 * one existing `repoSnapshot` MetaEnvelope for a repo and update it in place
 * (see evault/client.ts's `writeRepoSnapshot`) instead of creating a new one
 * every time - "replaces whenever anyone makes a commit" (the owner's own
 * words) means one envelope per repo, not one per push.
 *
 * Deliberately NOT `evault-core`'s `metaEnvelopes` list query: that query has
 * a confirmed, live, currently-unfixed ACL-filtering bug (see the spec's
 * Testing section) - unrelated to this store's own correctness, but using it
 * to "search for the existing envelope" would add an extra live dependency
 * and inherit a bug this service doesn't need to depend on when a local
 * mapping is simpler and already matches queue.ts's own persistence style:
 * one file per key, write-then-rename so a crash mid-write never leaves a
 * half-written, unparseable file behind.
 */
export class RepoEnvelopeStore {
    private readonly dir: string;

    constructor(options: { dir: string }) {
        this.dir = options.dir;
    }

    async init(): Promise<void> {
        await mkdir(this.dir, { recursive: true });
    }

    /**
     * repoFullName is "owner/name" - not filesystem-safe on its own (the "/"
     * would be read as a path separator), so it's flattened into one segment
     * the same way S3Storage.buildArchiveKey sanitises its own path
     * components, just joined instead of nested (a flat directory is enough
     * here - there's no need for the two-level layout the S3 key uses).
     */
    private filePath(repoFullName: string): string {
        const safe = repoFullName.replace(/[^\w.-]/g, "_");
        return path.join(this.dir, `${safe}.json`);
    }

    /** The existing envelope id for this repo, or `null` if none has been recorded yet. */
    async get(repoFullName: string): Promise<string | null> {
        try {
            const raw = await readFile(this.filePath(repoFullName), "utf8");
            const parsed = JSON.parse(raw) as { envelopeId: string };
            return parsed.envelopeId;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                return null;
            }
            throw error;
        }
    }

    /** Records (or overwrites) the envelope id a repo's snapshot lives at. */
    async set(repoFullName: string, envelopeId: string): Promise<void> {
        const filePath = this.filePath(repoFullName);
        const tmpPath = `${filePath}.tmp`;
        await writeFile(
            tmpPath,
            JSON.stringify({ repoFullName, envelopeId }, null, 2),
        );
        await rename(tmpPath, filePath);
    }
}
