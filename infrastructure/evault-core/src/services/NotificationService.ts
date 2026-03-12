import { Repository } from "typeorm";
import { Verification } from "../entities/Verification";
import { Notification } from "../entities/Notification";

export interface DeviceRegistration {
    eName: string;
    deviceId: string;
    platform: 'android' | 'ios' | 'desktop';
    pushToken?: string;
    registrationTime: Date;
}

export interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, any>;
}

export interface SendNotificationRequest {
    eName: string;
    notification: NotificationPayload;
    sharedSecret: string;
}

export class NotificationService {
    constructor(
        private verificationRepository: Repository<Verification>,
        private notificationRepository: Repository<Notification>
    ) {}

    async registerDevice(registration: DeviceRegistration): Promise<Verification> {
        const token = registration.pushToken?.trim();

        // If a token is provided, remove it from any OTHER eName's pushTokens
        if (token) {
            const others = await this.verificationRepository
                .createQueryBuilder("v")
                .where("v.linkedEName != :eName", { eName: registration.eName })
                .andWhere(":token = ANY(v.pushTokens)", { token })
                .getMany();

            for (const other of others) {
                other.pushTokens = (other.pushTokens ?? []).filter((t) => t !== token);
                other.updatedAt = new Date();
                await this.verificationRepository.save(other);
            }
        }

        let verification = await this.verificationRepository.findOne({
            where: {
                linkedEName: registration.eName,
                deviceId: registration.deviceId
            }
        });

        if (verification) {
            verification.platform = registration.platform;
            if (token) {
                const existing = verification.pushTokens ?? [];
                if (!existing.includes(token)) {
                    verification.pushTokens = [...existing, token];
                }
            }
            verification.deviceActive = true;
            verification.updatedAt = new Date();
        } else {
            verification = this.verificationRepository.create({
                linkedEName: registration.eName,
                deviceId: registration.deviceId,
                platform: registration.platform,
                pushTokens: token ? [token] : [],
                deviceActive: true,
                approved: true,
                consumed: false
            });
        }

        return await this.verificationRepository.save(verification);
    }

    async unregisterDevice(eName: string, deviceId: string): Promise<boolean> {
        const verification = await this.verificationRepository.findOne({
            where: { linkedEName: eName, deviceId }
        });

        if (verification) {
            verification.deviceActive = false;
            await this.verificationRepository.save(verification);
            return true;
        }

        return false;
    }

    async getDevicesByEName(eName: string): Promise<Verification[]> {
        return await this.verificationRepository.find({
            where: { linkedEName: eName, deviceActive: true }
        });
    }

    async sendNotificationToEName(eName: string, notification: NotificationPayload): Promise<boolean> {
        const verifications = await this.getDevicesByEName(eName);
        
        if (verifications.length === 0) {
            console.log(`No active devices found for eName: ${eName}`);
            return false;
        }

        const notificationEntity = this.notificationRepository.create({
            eName: eName,
            title: notification.title,
            body: notification.body,
            data: notification.data,
            delivered: false
        });

        await this.notificationRepository.save(notificationEntity);
        
        return true;
    }

    async getUndeliveredNotifications(eName: string): Promise<Notification[]> {
        return await this.notificationRepository.find({
            where: { eName, delivered: false },
            order: { createdAt: 'ASC' }
        });
    }

    async markNotificationAsDelivered(notificationId: string): Promise<void> {
        await this.notificationRepository.update(notificationId, {
            delivered: true,
            deliveredAt: new Date()
        });
    }

    async getAllDevices(): Promise<Verification[]> {
        return await this.verificationRepository.find({
            where: { deviceActive: true }
        });
    }

    async getDevicesWithPushTokens(): Promise<Verification[]> {
        const all = await this.getAllDevices();
        return all.filter((v) => v.pushTokens && v.pushTokens.length > 0);
    }

    async getDeviceStats(): Promise<{ totalDevices: number; devicesByPlatform: Record<string, number> }> {
        const verifications = await this.getAllDevices();
        const devicesByPlatform: Record<string, number> = {};
        
        verifications.forEach(verification => {
            if (verification.platform) {
                devicesByPlatform[verification.platform] = (devicesByPlatform[verification.platform] || 0) + 1;
            }
        });

        return {
            totalDevices: verifications.length,
            devicesByPlatform
        };
    }
}
