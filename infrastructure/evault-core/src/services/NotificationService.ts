import { Repository } from "typeorm";
import { Verification } from "../entities/Verification";
import { Notification } from "../entities/Notification";

export interface DeviceRegistration {
    eName: string;
    deviceId: string;
    platform: 'android' | 'ios' | 'desktop';
    fcmToken?: string;
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
        // Check if verification already exists for this eName AND deviceId combination
        let verification = await this.verificationRepository.findOne({
            where: { 
                linkedEName: registration.eName,
                deviceId: registration.deviceId
            }
        });

        if (verification) {
            // Update existing verification with device info
            verification.platform = registration.platform;
            verification.fcmToken = registration.fcmToken;
            verification.deviceActive = true;
            verification.updatedAt = new Date();
        } else {
            // Create new verification record with device info
            verification = this.verificationRepository.create({
                linkedEName: registration.eName,
                deviceId: registration.deviceId,
                platform: registration.platform,
                fcmToken: registration.fcmToken,
                deviceActive: true,
                approved: true, // Auto-approve for device registration
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

        // Store the notification in the database
        const notificationEntity = this.notificationRepository.create({
            eName: eName,
            title: notification.title,
            body: notification.body,
            data: notification.data,
            delivered: false
        });

        await this.notificationRepository.save(notificationEntity);
        console.log(`📱 Notification stored for eName: ${eName} (ID: ${notificationEntity.id})`);
        
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
