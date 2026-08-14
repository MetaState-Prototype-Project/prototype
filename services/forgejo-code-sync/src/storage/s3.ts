import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Uploads commit diffs to the same DigitalOcean Spaces (S3-compatible) bucket
 * evault-core's own StorageService.ts uses, so diff content is never inlined
 * into an eVault MetaEnvelope - the eVault gets a link, not the blob. See
 * docs/superpowers/specs/2026-08-14-forgejo-code-sync-design.md ("What gets
 * written"). Uploads directly to S3, bypassing evault-core's own `uploadFile`
 * GraphQL mutation deliberately: that mutation caps at 250MB
 * (evault-core's `MAX_FILE_BYTES`) on top of a 350MB request-body limit,
 * neither of which is "any amount" - S3 itself has no such ceiling.
 */
export interface S3StorageOptions {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    /** Public/CDN base URL; defaults to the bucket sub-domain on the endpoint. */
    cdnUrl?: string;
}

export class S3Storage {
    private readonly client: S3Client;
    private readonly bucket: string;
    private readonly cdnBaseUrl: string;

    constructor(options: S3StorageOptions) {
        this.bucket = options.bucket;
        this.cdnBaseUrl = (
            options.cdnUrl ||
            options.endpoint.replace("https://", `https://${options.bucket}.`)
        ).replace(/\/$/, "");

        this.client = new S3Client({
            endpoint: options.endpoint,
            region: options.region,
            forcePathStyle: false,
            credentials: {
                accessKeyId: options.accessKeyId,
                secretAccessKey: options.secretAccessKey,
            },
        });
    }

    /**
     * Deterministic object key for one commit's diff, scoped under the
     * author's own eName so keys from different people never collide.
     */
    static buildKey(
        eName: string,
        repoFullName: string,
        commitId: string,
    ): string {
        const owner = eName.replace(/^@/, "").replace(/[^\w.-]/g, "_");
        const repo = repoFullName.replace(/[^\w.-]/g, "_");
        return `diffs/${owner}/${repo}/${commitId}.diff`;
    }

    /**
     * Uploads a diff's raw text and returns its URL.
     *
     * `isPublic` mirrors the same repo-visibility signal `deriveAcl` (see
     * evault/acl.ts) uses for the MetaEnvelope's own ACL: a private repo's
     * diff must not be uploaded `public-read`, or the S3 object itself
     * becomes readable by anyone with the URL regardless of what ACL the
     * eVault envelope carries - the same protection would be undermined one
     * layer down. A private-repo diff is uploaded with no public ACL, so its
     * URL is not fetchable without the bucket's own credentials; there is
     * deliberately no presigned-URL-on-read feature built here, out of scope
     * for this pass.
     */
    async uploadDiff(
        eName: string,
        repoFullName: string,
        commitId: string,
        diffText: string,
        isPublic: boolean,
    ): Promise<string> {
        const key = S3Storage.buildKey(eName, repoFullName, commitId);
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: Buffer.from(diffText, "utf8"),
                ContentType: "text/x-diff",
                ...(isPublic ? { ACL: "public-read" as const } : {}),
            }),
        );
        return `${this.cdnBaseUrl}/${key}`;
    }
}
