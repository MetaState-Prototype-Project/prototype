import { Repository } from "typeorm";
import { DeviceToken } from "../entities/DeviceToken";

export interface DeviceTokenRegistration {
    eName: string;
    deviceId: string;
    platform: string;
    token: string;
}

export class DeviceTokenService {
    constructor(private deviceTokenRepository: Repository<DeviceToken>) {}

    async register(registration: DeviceTokenRegistration): Promise<DeviceToken> {
        const { eName, deviceId, platform, token } = registration;

        // 1. Exact match: same eName + deviceId → update token/platform
        const byEnameAndDevice = await this.deviceTokenRepository.findOne({
            where: { eName, deviceId },
        });
        if (byEnameAndDevice) {
            byEnameAndDevice.token = token;
            byEnameAndDevice.platform = platform;
            byEnameAndDevice.updatedAt = new Date();
            return this.deviceTokenRepository.save(byEnameAndDevice);
        }

        // 2. Same token (same physical device) but different eName or deviceId → update eName/deviceId
        const byToken = await this.deviceTokenRepository.findOne({
            where: { token },
        });
        if (byToken) {
            byToken.eName = eName;
            byToken.deviceId = deviceId;
            byToken.platform = platform;
            byToken.updatedAt = new Date();
            return this.deviceTokenRepository.save(byToken);
        }

        // 3. Both eName and token are new → create
        const deviceToken = this.deviceTokenRepository.create({
            eName,
            deviceId,
            platform,
            token,
        });
        return this.deviceTokenRepository.save(deviceToken);
    }

    async getDevicesWithTokens(): Promise<
        { token: string; platform: string; eName: string }[]
    > {
        const tokens = await this.deviceTokenRepository.find({
            order: { updatedAt: "DESC" },
        });
        return tokens.map((t) => ({
            token: t.token,
            platform: t.platform,
            eName: t.eName,
        }));
    }

    async getDevicesByEName(eName: string): Promise<
        { token: string; platform: string; eName: string }[]
    > {
        const normalized = eName.startsWith("@") ? eName : `@${eName}`;
        const withoutAt = eName.replace(/^@/, "");
        const tokens = await this.deviceTokenRepository
            .createQueryBuilder("dt")
            .where("dt.eName = :e1 OR dt.eName = :e2", {
                e1: normalized,
                e2: withoutAt,
            })
            .orderBy("dt.updatedAt", "DESC")
            .getMany();
        return tokens.map((t) => ({
            token: t.token,
            platform: t.platform,
            eName: t.eName,
        }));
    }

    async getDeviceCount(): Promise<number> {
        return this.deviceTokenRepository.count();
    }

    async unregister(eName: string, deviceId: string): Promise<boolean> {
        const result = await this.deviceTokenRepository.delete({
            eName,
            deviceId,
        });
        return (result.affected ?? 0) > 0;
    }
}
