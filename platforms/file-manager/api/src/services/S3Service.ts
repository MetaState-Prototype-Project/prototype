import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";

export class S3Service {
    private _client: S3Client | null = null;
    private _bucket: string = "";
    private _region: string = "";
    private _cdnEndpoint: string = "";
    private _originEndpoint: string = "";
    private _initialized = false;

    private init() {
        if (this._initialized) return;
        this._initialized = true;

        this._originEndpoint = process.env.S3_ORIGIN || "";
        this._cdnEndpoint = process.env.S3_CDN || "";

        if (!this._originEndpoint) {
            console.warn("S3_ORIGIN not set — S3 features will not work");
            return;
        }

        const originUrl = new URL(this._originEndpoint);
        const hostParts = originUrl.hostname.split(".");
        this._bucket = hostParts[0];
        this._region = hostParts[1];

        this._client = new S3Client({
            endpoint: `https://${this._region}.digitaloceanspaces.com`,
            region: this._region,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY || "",
                secretAccessKey: process.env.S3_SECRET_KEY || "",
            },
            forcePathStyle: false,
        });
    }

    private get client(): S3Client {
        this.init();
        if (!this._client) throw new Error("S3 not configured — set S3_ORIGIN env var");
        return this._client;
    }

    private get bucket(): string {
        this.init();
        return this._bucket;
    }

    generateKey(userId: string, fileId: string, filename: string): string {
        return `files/${userId}/${fileId}/${filename}`;
    }

    async generateUploadUrl(key: string, contentType: string): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: contentType,
            ACL: "public-read",
        });

        return getSignedUrl(this.client, command, { expiresIn: 900 });
    }

    getPublicUrl(key: string): string {
        this.init();
        return `${this._cdnEndpoint}/${key}`;
    }

    extractKeyFromUrl(url: string): string {
        this.init();
        if (this._cdnEndpoint && url.startsWith(this._cdnEndpoint)) {
            return url.slice(this._cdnEndpoint.length + 1);
        }
        if (this._originEndpoint && url.startsWith(this._originEndpoint)) {
            return url.slice(this._originEndpoint.length + 1);
        }
        const urlObj = new URL(url);
        return urlObj.pathname.slice(1);
    }

    async headObject(key: string): Promise<{ contentLength: number; etag: string }> {
        const command = new HeadObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        const response = await this.client.send(command);
        return {
            contentLength: response.ContentLength || 0,
            etag: (response.ETag || "").replace(/"/g, ""),
        };
    }

    async deleteObject(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });
        await this.client.send(command);
    }

    async getObjectStream(key: string): Promise<Readable> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        const response = await this.client.send(command);
        return response.Body as Readable;
    }
}
