import { Repository } from "typeorm";
import { DeviceToken } from "../entities/DeviceToken";

export class DeviceTokenService {
    constructor(private deviceTokenRepository: Repository<DeviceToken>) {}

    async register(eName: string, token: string): Promise<DeviceToken> {
        // Remove this token from any OTHER eName (device switched accounts)
        const others = await this.deviceTokenRepository
            .createQueryBuilder("dt")
            .where("dt.eName != :eName", { eName })
            .andWhere(":token = ANY(dt.tokens)", { token })
            .getMany();

        for (const other of others) {
            other.tokens = other.tokens.filter((t) => t !== token);
            other.updatedAt = new Date();
            await this.deviceTokenRepository.save(other);
        }

        // Find or create the row for this eName
        let row = await this.deviceTokenRepository.findOne({
            where: { eName },
        });

        if (row) {
            if (!row.tokens.includes(token)) {
                row.tokens = [...row.tokens, token];
            }
            row.updatedAt = new Date();
            return this.deviceTokenRepository.save(row);
        }

        row = this.deviceTokenRepository.create({
            eName,
            tokens: [token],
        });
        return this.deviceTokenRepository.save(row);
    }

    async getDevicesWithTokens(): Promise<
        { token: string; eName: string }[]
    > {
        const rows = await this.deviceTokenRepository.find({
            order: { updatedAt: "DESC" },
        });
        return rows.flatMap((r) =>
            r.tokens.map((token) => ({ token, eName: r.eName })),
        );
    }

    async getDevicesByEName(eName: string): Promise<
        { token: string; eName: string }[]
    > {
        const normalized = eName.startsWith("@") ? eName : `@${eName}`;
        const withoutAt = eName.replace(/^@/, "");

        const rows = await this.deviceTokenRepository
            .createQueryBuilder("dt")
            .where("dt.eName = :e1 OR dt.eName = :e2", {
                e1: normalized,
                e2: withoutAt,
            })
            .orderBy("dt.updatedAt", "DESC")
            .getMany();

        return rows.flatMap((r) =>
            r.tokens.map((token) => ({ token, eName: r.eName })),
        );
    }

    async getDeviceCount(): Promise<number> {
        const rows = await this.deviceTokenRepository.find();
        return rows.reduce((sum, r) => sum + (r.tokens?.length ?? 0), 0);
    }

    async unregister(eName: string, token: string): Promise<boolean> {
        const row = await this.deviceTokenRepository.findOne({
            where: { eName },
        });

        if (!row) return false;

        const before = row.tokens.length;
        row.tokens = row.tokens.filter((t) => t !== token);

        if (row.tokens.length === before) return false;

        row.updatedAt = new Date();
        await this.deviceTokenRepository.save(row);
        return true;
    }
}
