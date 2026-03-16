import { Repository } from "typeorm";
import { Verification } from "../entities/Verification";
import { Notification } from "../entities/Notification";
import { DeviceToken } from "../entities/DeviceToken";

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

const BAD_TOKEN_ERRORS = [
    "messaging/registration-token-not-valid",
    "messaging/invalid-registration-token",
    "BadDeviceToken",
    "Unregistered",
    "DeviceTokenNotForTopic",
];

function isBadTokenError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return BAD_TOKEN_ERRORS.some((e) => msg.includes(e));
}

export class NotificationService {
    constructor(
        private verificationRepository: Repository<Verification>,
        private notificationRepository: Repository<Notification>,
        private deviceTokenRepository?: Repository<DeviceToken>,
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
                // Replace all tokens for this device — the latest token from the
                // OS is the only valid one. Appending caused stale tokens to
                // accumulate and never get cleaned up.
                verification.pushTokens = [token];
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
        console.log(`[NOTIF] Using trigger URL: ${triggerUrl}`);
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

        // Cycle through tokens sequentially: try each one, remove bad tokens
        // inline, and keep going until at least one succeeds.
        const badTokens: string[] = [];
        let delivered = false;

        for (const { token, platform } of allTokens) {
            try {
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

                if (data.success) {
                    console.log(`[NOTIF] Push delivered via token ${token.slice(0, 8)}… for ${eName}`);
                    delivered = true;
                    // Keep sending to remaining tokens — user may have multiple
                    // devices (phone + tablet) that should all receive the notif.
                    continue;
                }

                // Send returned an explicit failure
                const error = data.error || "Push send failed";
                console.error(
                    `[NOTIF] Push rejected for token ${token.slice(0, 8)}…\n` +
                    `  platform : ${platform ?? "auto-detect"}\n` +
                    `  error    : ${error}`,
                );

                if (isBadTokenError(error)) {
                    badTokens.push(token);
                    console.log(`[NOTIF] Bad token ${token.slice(0, 8)}… queued for removal, trying next…`);
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                const errObj = err as Record<string, unknown>;
                const rawCause = errObj?.cause;
                const cause = rawCause
                    ? rawCause instanceof Error ? rawCause.message : String(rawCause)
                    : null;
                console.error(
                    `[NOTIF] Push error for token ${token.slice(0, 8)}…\n` +
                    `  platform : ${platform ?? "auto-detect"}\n` +
                    `  url      : ${triggerUrl}/api/send\n` +
                    `  error    : ${msg}\n` +
                    (cause ? `  cause    : ${cause}\n` : "") +
                    `  full     :`, err,
                );

                if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED")) {
                    console.error(`[NOTIF] notification-trigger service appears to be DOWN at ${triggerUrl} — skipping remaining tokens`);
                    break;
                }

                if (isBadTokenError(err)) {
                    badTokens.push(token);
                    console.log(`[NOTIF] Bad token ${token.slice(0, 8)}… queued for removal, trying next…`);
                }
            }
        }

        // Purge bad tokens from both Verification and DeviceToken tables
        if (badTokens.length > 0) {
            console.log(`[NOTIF] Removing ${badTokens.length} bad token(s) for ${eName}`);
            await this.removeBadTokens(eName, badTokens);
        }

        if (delivered) {
            console.log(`[NOTIF] Push delivered for ${eName}`);
        } else {
            console.log(`[NOTIF] Push failed for all ${allTokens.length} token(s) for ${eName}`);
        }

        return delivered;
    }

    private async removeBadTokens(eName: string, badTokens: string[]): Promise<void> {
        try {
            // Clean Verification table
            const verifications = await this.verificationRepository.find({
                where: { linkedEName: eName },
            });
            for (const v of verifications) {
                const before = v.pushTokens?.length ?? 0;
                v.pushTokens = (v.pushTokens ?? []).filter((t) => !badTokens.includes(t));
                if (v.pushTokens.length !== before) {
                    v.updatedAt = new Date();
                    await this.verificationRepository.save(v);
                }
            }

            // Clean DeviceToken table
            if (this.deviceTokenRepository) {
                const normalized = eName.startsWith("@") ? eName : `@${eName}`;
                const withoutAt = eName.replace(/^@/, "");
                const rows = await this.deviceTokenRepository
                    .createQueryBuilder("dt")
                    .where("dt.eName = :e1 OR dt.eName = :e2", { e1: normalized, e2: withoutAt })
                    .getMany();

                for (const row of rows) {
                    const before = row.tokens.length;
                    row.tokens = row.tokens.filter((t) => !badTokens.includes(t));
                    if (row.tokens.length !== before) {
                        row.updatedAt = new Date();
                        await this.deviceTokenRepository.save(row);
                    }
                }
            }
        } catch (err) {
            console.error(`[NOTIF] Failed to remove bad tokens for ${eName}:`, err);
        }
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
