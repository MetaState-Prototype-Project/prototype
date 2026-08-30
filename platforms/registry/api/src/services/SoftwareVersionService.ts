import { createHash } from "node:crypto";
import type { Repository } from "typeorm";
import type { SoftwareVersion } from "../entities/SoftwareVersion";

export class SoftwareVersionConflictError extends Error {}

function uuidBytes(value: string): Buffer {
    const normalized = value.replace(/^@/, "").replace(/-/g, "");
    if (!/^[0-9a-f]{32}$/i.test(normalized)) {
        throw new Error("platformEName must contain a UUID");
    }
    return Buffer.from(normalized, "hex");
}

function formatUuid(bytes: Buffer): string {
    const hex = bytes.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function softwareVersionEName(platformEname: string, version: string): string {
    const namespace = uuidBytes(platformEname);
    const digest = createHash("sha1")
        .update(namespace)
        .update(Buffer.from(`software-version:${version}`, "utf8"))
        .digest()
        .subarray(0, 16);
    digest[6] = (digest[6] & 0x0f) | 0x50;
    digest[8] = (digest[8] & 0x3f) | 0x80;
    return `@${formatUuid(digest)}`;
}

export function normalizeSoftwareVersion(value: string): string {
    const normalized = value.trim().replace(/^v/, "");
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized)) {
        throw new Error("version must be semantic, such as 1.2.3");
    }
    return normalized;
}

export interface CreateSoftwareVersionInput {
    platformEname: string;
    version: string;
    releaseTag: string;
    commitSha: string;
}

export class SoftwareVersionService {
    constructor(private readonly repository: Repository<SoftwareVersion>) {}

    async create(input: CreateSoftwareVersionInput): Promise<SoftwareVersion> {
        const platformEname = input.platformEname.trim().startsWith("@")
            ? input.platformEname.trim()
            : `@${input.platformEname.trim()}`;
        const version = normalizeSoftwareVersion(input.version);
        const releaseTag = input.releaseTag.trim();
        const commitSha = input.commitSha.trim().toLowerCase();
        if (!releaseTag || !/^[0-9a-f]{40,64}$/.test(commitSha)) {
            throw new Error("releaseTag and a Git commit SHA are required");
        }

        const existing = await this.repository.findOneBy({ platformEname, version });
        if (existing) {
            if (existing.releaseTag !== releaseTag || existing.commitSha !== commitSha) {
                throw new SoftwareVersionConflictError(
                    `Version ${version} is already bound to a different release`,
                );
            }
            return existing;
        }

        return this.repository.save(this.repository.create({
            ename: softwareVersionEName(platformEname, version),
            platformEname,
            version,
            releaseTag,
            commitSha,
        }));
    }

    async findByEname(ename: string): Promise<SoftwareVersion | null> {
        const normalized = ename.startsWith("@") ? ename : `@${ename}`;
        return this.repository.findOneBy({ ename: normalized });
    }
}
