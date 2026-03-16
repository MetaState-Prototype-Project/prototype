import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";

export class S3Service {
    private client: S3Client;
    private bucket: string;
    private cdnEndpoint: string;
    private originEndpoint: string;

    constructor() {
        // S3_ORIGIN = https://<space-name>.<region>.digitaloceanspaces.com
        // S3_CDN = https://<space-name>.<region>.cdn.digitaloceanspaces.com
        // S3_ACCESS_KEY, S3_SECRET_KEY
        this.originEndpoint = process.env.S3_ORIGIN || "";
        this.cdnEndpoint = process.env.S3_CDN || "";

        // Extract bucket name and region from origin URL
        // e.g. https://myspace.nyc3.digitaloceanspaces.com → bucket=myspace, region=nyc3
        const originUrl = new URL(this.originEndpoint);
        const hostParts = originUrl.hostname.split(".");
        this.bucket = hostParts[0];
        const region = hostParts[1];

        this.client = new S3Client({
            endpoint: `https://${region}.digitaloceanspaces.com`,
            region,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY || "",
                secretAccessKey: process.env.S3_SECRET_KEY || "",
            },
            forcePathStyle: false,
        });
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

        return getSignedUrl(this.client, command, { expiresIn: 900 }); // 15 minutes
    }

    getPublicUrl(key: string): string {
        return `${this.cdnEndpoint}/${key}`;
    }

    extractKeyFromUrl(url: string): string {
        if (url.startsWith(this.cdnEndpoint)) {
            return url.slice(this.cdnEndpoint.length + 1);
        }
        if (url.startsWith(this.originEndpoint)) {
            return url.slice(this.originEndpoint.length + 1);
        }
        // Fallback: extract path from URL
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
