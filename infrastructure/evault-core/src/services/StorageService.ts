import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Thrown when the DigitalOcean Spaces environment is not configured.
 */
export class StorageNotConfiguredError extends Error {
    constructor() {
        super(
            "Object storage is not configured. Set DO_SPACES_ENDPOINT, " +
                "DO_SPACES_REGION, DO_SPACES_KEY, DO_SPACES_SECRET and DO_SPACES_BUCKET.",
        );
        this.name = "StorageNotConfiguredError";
    }
}

interface UploadObjectInput {
    buffer: Buffer;
    contentType: string;
    key: string;
}

/**
 * StorageService uploads file blobs to DigitalOcean Spaces (an S3-compatible
 * object store) and returns publicly reachable URLs. eVault uses this instead
 * of base64-stuffing binary data into Neo4j envelopes.
 */
export class StorageService {
    private readonly client: S3Client;
    private readonly bucket: string;
    private readonly cdnBaseUrl: string;

    constructor() {
        const endpoint = process.env.DO_SPACES_ENDPOINT;
        const region = process.env.DO_SPACES_REGION;
        const key = process.env.DO_SPACES_KEY;
        const secret = process.env.DO_SPACES_SECRET;
        const bucket = process.env.DO_SPACES_BUCKET;

        if (!endpoint || !region || !key || !secret || !bucket) {
            throw new StorageNotConfiguredError();
        }

        this.bucket = bucket;
        // Public base for constructed URLs — a CDN/edge domain if provided,
        // otherwise the bucket sub-domain on the Spaces endpoint.
        this.cdnBaseUrl = (
            process.env.DO_SPACES_CDN_URL ||
            `${endpoint.replace("https://", `https://${bucket}.`)}`
        ).replace(/\/$/, "");

        this.client = new S3Client({
            endpoint,
            region,
            forcePathStyle: false,
            credentials: { accessKeyId: key, secretAccessKey: secret },
        });
    }

    /**
     * Returns true when the Spaces environment variables are all present.
     */
    static isConfigured(): boolean {
        return Boolean(
            process.env.DO_SPACES_ENDPOINT &&
                process.env.DO_SPACES_REGION &&
                process.env.DO_SPACES_KEY &&
                process.env.DO_SPACES_SECRET &&
                process.env.DO_SPACES_BUCKET,
        );
    }

    /**
     * Builds a deterministic object key for a file owned by an eName.
     */
    static buildKey(eName: string, filename: string, id: string): string {
        const owner = eName.replace(/^@/, "").replace(/[^\w.-]/g, "_");
        const safeName = filename.replace(/[^\w.-]/g, "_");
        return `files/${owner}/${id}-${safeName}`;
    }

    /**
     * Uploads a public-read object and returns its public URL.
     */
    async uploadObject({
        buffer,
        contentType,
        key,
    }: UploadObjectInput): Promise<string> {
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: buffer,
                ContentType: contentType,
                ACL: "public-read",
            }),
        );

        return `${this.cdnBaseUrl}/${key}`;
    }
}
