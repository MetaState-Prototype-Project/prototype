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

        // Save to DB for in-app polling regardless of device presence
        const notificationEntity = this.notificationRepository.create({
            eName: eName,
            title: notification.title,
            body: notification.body,
            data: notification.data,
            delivered: false
        });
        await this.notificationRepository.save(notificationEntity);

        if (verifications.length === 0) {
            console.log(`[NOTIF] No active devices found for eName: ${eName}`);
            return false;
        }

        // Send actual push notification via notification-trigger service
        const triggerUrl = process.env.NOTIFICATION_TRIGGER_URL || `http://localhost:${process.env.NOTIFICATION_TRIGGER_PORT || 3998}`;
        const pushPayload = {
            title: notification.title,
            body: notification.body,
            sound: "default",
            ...(notification.data && {
                data: Object.fromEntries(
                    Object.entries(notification.data).map(([k, v]) => [k, String(v)])
                ),
            }),
        };

        // Collect all push tokens from all active devices for this eName, deduped
        const seenTokens = new Set<string>();
        const allTokens: { token: string; platform?: string }[] = [];
        for (const v of verifications) {
            if (v.pushTokens && v.pushTokens.length > 0) {
                for (const token of v.pushTokens) {
                    if (!seenTokens.has(token)) {
                        seenTokens.add(token);
                        allTokens.push({ token, platform: v.platform });
                    }
                }
            }
        }

        console.log(`[NOTIF] ${verifications.length} verification(s), ${seenTokens.size} unique token(s) for eName: ${eName}`);

        if (allTokens.length === 0) {
            console.log(`[NOTIF] No push tokens for eName: ${eName} (${verifications.length} device(s) but no tokens)`);
            return true; // Still saved to DB for in-app polling
        }

        console.log(`[NOTIF] Sending push to ${allTokens.length} token(s) for eName: ${eName}`);

        const pushResults = await Promise.allSettled(
            allTokens.map(async ({ token, platform }) => {
                const res = await fetch(`${triggerUrl}/api/send`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        token,
                        ...(platform && platform !== "desktop" ? { platform } : {}),
                        payload: pushPayload,
                    }),
                    signal: AbortSignal.timeout(10000),
                });
                const data = await res.json();
                if (!data.success) {
                    throw new Error(data.error || "Push send failed");
                }
                return data;
            })
        );

        const pushSucceeded = pushResults.filter(r => r.status === "fulfilled").length;
        const pushFailed = pushResults.filter(r => r.status === "rejected").length;
        if (pushFailed > 0) {
            console.log(`[NOTIF] Push results for ${eName}: ${pushSucceeded} sent, ${pushFailed} failed`);
            pushResults.forEach((r, i) => {
                if (r.status === "rejected") {
                    console.error(`[NOTIF] Push failed for token index ${i}:`, r.reason);
                }
            });
        } else {
            console.log(`[NOTIF] Push sent successfully to ${pushSucceeded} token(s) for ${eName}`);
        }

        return pushSucceeded > 0 || pushFailed === 0;
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
