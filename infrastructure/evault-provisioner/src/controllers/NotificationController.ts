import { Request, Response } from "express";
import { NotificationService } from "../services/NotificationService";
import { AppDataSource } from "../config/database";
import { Notification } from "../entities/Notification";

export class NotificationController {
    private notificationService: NotificationService;

    constructor() {
        this.notificationService = new NotificationService(
            AppDataSource.getRepository("Verification"),
            AppDataSource.getRepository("Notification")
        );
    }

    registerRoutes(app: any) {
        // Register device endpoint
        app.post("/api/devices/register", this.registerDevice.bind(this));
        
        // Unregister device endpoint
        app.post("/api/devices/unregister", this.unregisterDevice.bind(this));
        
        // Send notification endpoint
        app.post("/api/notifications/send", this.sendNotification.bind(this));
        
        // Check for notifications endpoint
        app.post("/api/notifications/check", this.checkNotifications.bind(this));
        
        // Get device stats endpoint
        app.get("/api/devices/stats", this.getDeviceStats.bind(this));
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

            const registration = {
                eName,
                deviceId,
                platform,
                fcmToken,
                registrationTime: new Date()
            };

            const verification = await this.notificationService.registerDevice(registration);
            
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
