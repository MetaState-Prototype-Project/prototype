import crypto from "crypto";
import { AppDataSource } from "../database/data-source";
import { ApiKey } from "../database/entities/ApiKey";

const KEY_PREFIX = "aaas_";

/** Issues and verifies long-lived consumer API keys. Only hashes are stored. */
export class ApiKeyService {
    private hash(plaintext: string): string {
        return crypto.createHash("sha256").update(plaintext).digest("hex");
    }

    /**
     * Creates a new key for a consumer. Returns the plaintext exactly once -
     * it is never recoverable afterwards.
     */
    async issue(
        consumerId: string,
    ): Promise<{ apiKey: ApiKey; plaintext: string }> {
        const plaintext = KEY_PREFIX + crypto.randomBytes(24).toString("hex");
        const repo = AppDataSource.getRepository(ApiKey);
        const apiKey = repo.create({
            consumerId,
            keyHash: this.hash(plaintext),
            keyPrefix: plaintext.slice(0, 12),
            revoked: false,
        });
        await repo.save(apiKey);
        return { apiKey, plaintext };
    }

    /** Resolves a plaintext key to its (non-revoked) ApiKey row, or null. */
    async verify(plaintext: string): Promise<ApiKey | null> {
        const apiKey = await AppDataSource.getRepository(ApiKey).findOne({
            where: { keyHash: this.hash(plaintext), revoked: false },
        });
        if (apiKey) {
            // best-effort last-used tracking
            void AppDataSource.getRepository(ApiKey).update(apiKey.id, {
                lastUsedAt: new Date(),
            });
        }
        return apiKey;
    }

    async revoke(id: string, consumerId: string): Promise<boolean> {
        const result = await AppDataSource.getRepository(ApiKey).update(
            { id, consumerId },
            { revoked: true },
        );
        return (result.affected ?? 0) > 0;
    }
}
