import { Request, Response } from "express";
import { NotificationService } from "../services/NotificationService";
import { DeviceTokenService } from "../services/DeviceTokenService";
import { AppDataSource } from "../config/database";
import { DeviceToken } from "../entities/DeviceToken";

export class NotificationController {
    private notificationService: NotificationService;
    private deviceTokenService: DeviceTokenService;

    constructor() {
        this.notificationService = new NotificationService(
            AppDataSource.getRepository("Verification"),
            AppDataSource.getRepository("Notification")
        );
        this.deviceTokenService = new DeviceTokenService(
            AppDataSource.getRepository(DeviceToken)
        );
    }

    registerRoutes(app: any) {
        app.post("/api/devices/register", this.registerDevice.bind(this));
        app.post("/api/devices/unregister", this.unregisterDevice.bind(this));
        app.post("/api/notifications/send", this.sendNotification.bind(this));
        app.post("/api/notifications/check", this.checkNotifications.bind(this));
        app.get("/api/devices/stats", this.getDeviceStats.bind(this));
        app.get("/api/devices/list", this.listDevicesWithTokens.bind(this));
        app.get("/api/devices/by-ename/:eName", this.getDevicesByEName.bind(this));
    }

    private async listDevicesWithTokens(req: Request, res: Response) {
        try {
            const devices = await this.deviceTokenService.getDevicesWithTokens();
            res.json({ success: true, devices });
        } catch (error) {
            console.error("Error listing devices:", error);
            res.status(500).json({
                success: false,
                error: "Failed to list devices",
            });
        }
    }

    private async getDevicesByEName(req: Request, res: Response) {
        try {
            const eName = req.params.eName;
            if (!eName) {
                return res.status(400).json({
                    success: false,
                    error: "Missing eName",
                });
            }
            const devices = await this.deviceTokenService.getDevicesByEName(
                decodeURIComponent(eName)
            );
            res.json({ success: true, devices });
        } catch (error) {
            console.error("Error getting devices by eName:", error);
            res.status(500).json({
                success: false,
                error: "Failed to get devices",
            });
        }
    }

    private async registerDevice(req: Request, res: Response) {
        try {
            const { eName, deviceId, platform, fcmToken } = req.body;

            if (!eName || !deviceId || !platform) {
                return res.status(400).json({
                    success: false,
                    error: "Missing required fields: eName, deviceId, platform"
                });
            }

            if (fcmToken && typeof fcmToken === "string" && fcmToken.trim()) {
                await this.deviceTokenService.register({
                    eName,
                    deviceId,
                    platform,
                    token: fcmToken.trim(),
                });
            }

            const verification = await this.notificationService.registerDevice({
                eName,
                deviceId,
                platform,
                fcmToken: fcmToken.trim(),
                registrationTime: new Date(),
            });

            res.json({
                success: true,
                message: "Device registered successfully",
                verificationId: verification.id
            });
        } catch (error) {
            console.error("Error registering device:", error);
            res.status(500).json({
                success: false,
                error: "Failed to register device"
            });
        }
    }

    private async unregisterDevice(req: Request, res: Response) {
        try {
            const { eName, deviceId } = req.body;

            if (!eName || !deviceId) {
                return res.status(400).json({
                    success: false,
                    error: "Missing required fields: eName, deviceId"
                });
            }

            await this.deviceTokenService.unregister(eName, deviceId);
            const success = await this.notificationService.unregisterDevice(eName, deviceId);
            
            res.json({
                success,
                message: success ? "Device unregistered successfully" : "Device not found"
            });
        } catch (error) {
            console.error("Error unregistering device:", error);
            res.status(500).json({
                success: false,
                error: "Failed to unregister device"
            });
        }
    }

    private async sendNotification(req: Request, res: Response) {
        try {
            const { eName, notification, sharedSecret } = req.body;

            // Verify shared secret
            if (sharedSecret !== process.env.NOTIFICATION_SHARED_SECRET) {
                return res.status(401).json({
                    success: false,
                    error: "Invalid shared secret"
                });
            }

            if (!eName || !notification?.title || !notification?.body) {
                return res.status(400).json({
                    success: false,
                    error: "Missing required fields: eName, notification.title, notification.body"
                });
            }

            const success = await this.notificationService.sendNotificationToEName(eName, notification);
            
            res.json({
                success,
                message: success ? "Notification sent successfully" : "No active devices found for eName"
            });
        } catch (error) {
            console.error("Error sending notification:", error);
            res.status(500).json({
                success: false,
                error: "Failed to send notification"
            });
        }
    }

    private async checkNotifications(req: Request, res: Response) {
        try {
            const { eName, deviceId } = req.body;

            if (!eName || !deviceId) {
                return res.status(400).json({
                    success: false,
                    error: "Missing required fields: eName, deviceId"
                });
            }

            // Get undelivered notifications for this eName
            const notifications = await this.notificationService.getUndeliveredNotifications(eName);
            
            // Mark notifications as delivered
            for (const notification of notifications) {
                await this.notificationService.markNotificationAsDelivered(notification.id);
            }
            
            // Convert to the format expected by the client
            const notificationPayloads = notifications.map(n => ({
                title: n.title,
                body: n.body,
                data: n.data
            }));
            
            console.log(`📱 Returning ${notificationPayloads.length} notification(s) for eName: ${eName}`);
            
            res.json({
                success: true,
                notifications: notificationPayloads
            });
        } catch (error) {
            console.error("Error checking notifications:", error);
            res.status(500).json({
                success: false,
                error: "Failed to check notifications"
            });
        }
    }

    private async getDeviceStats(req: Request, res: Response) {
        try {
            const stats = await this.notificationService.getDeviceStats();
            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error("Error getting device stats:", error);
            res.status(500).json({
                success: false,
                error: "Failed to get device stats"
            });
        }
    }
}
