import {
    requestPermission,
    isPermissionGranted,
    sendNotification,
} from "@tauri-apps/plugin-notification";
import { invoke } from "@tauri-apps/api/core";
import { PUBLIC_PROVISIONER_URL } from "$env/static/public";

export interface DeviceRegistration {
    eName: string;
    deviceId: string;
    platform: "android" | "ios" | "desktop";
    fcmToken?: string; // For Android/iOS push notifications
    registrationTime: Date;
}

export interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, any>;
}

class NotificationService {
    private static instance: NotificationService;
    private deviceRegistration: DeviceRegistration | null = null;
    private provisionerEndpoint: string;

    constructor() {
        // Get the provisioner endpoint from environment or use default
        this.provisionerEndpoint = PUBLIC_PROVISIONER_URL;
    }

    static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Request notification permissions
     */
    async requestPermissions(): Promise<boolean> {
        try {
            // First check if permission is already granted
            const isGranted = await isPermissionGranted();
            console.log("Notification permission already granted:", isGranted);

            if (isGranted) {
                return true;
            }

            // Request permission if not granted
            const permission = await requestPermission();
            console.log("Permission request result:", permission);
            return permission === "granted";
        } catch (error) {
            console.error("Failed to request notification permissions:", error);
            return false;
        }
    }

    /**
     * Register device with the provisioner service
     */
    async registerDevice(eName: string): Promise<boolean> {
        try {
            // Get device information
            const deviceId = await this.getDeviceId();
            const platform = await this.getPlatform();

            // Request notification permissions first
            const hasPermission = await this.requestPermissions();
            if (!hasPermission) {
                throw new Error("Notification permissions not granted");
            }

            // Get FCM token for mobile platforms
            let fcmToken: string | undefined;
            if (platform === "android" || platform === "ios") {
                fcmToken = await this.getFCMToken();
            }

            const registration: DeviceRegistration = {
                eName,
                deviceId,
                platform,
                fcmToken,
                registrationTime: new Date(),
            };

            // Send registration to provisioner
            const response = await fetch(
                `${this.provisionerEndpoint}/api/devices/register`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(registration),
                },
            );

            if (response.ok) {
                this.deviceRegistration = registration;
                console.log("Device registered successfully:", registration);
                return true;
            } else {
                throw new Error(`Registration failed: ${response.statusText}`);
            }
        } catch (error) {
            console.error("Failed to register device:", error);
            return false;
        }
    }

    /**
     * Send a local notification
     */
    async sendLocalNotification(payload: NotificationPayload): Promise<void> {
        try {
            console.log("Attempting to send local notification:", payload);

            // Check permissions first
            const hasPermission = await isPermissionGranted();
            console.log("Has notification permission:", hasPermission);

            if (!hasPermission) {
                console.warn("No notification permission, requesting...");
                const granted = await this.requestPermissions();
                if (!granted) {
                    console.error("Failed to get notification permission");
                    return;
                }
            }

            console.log("Sending notification with payload:", {
                title: payload.title,
                body: payload.body,
                icon: "icons/32x32.png",
                sound: "default",
                data: payload.data,
            });

            await sendNotification({
                title: payload.title,
                body: payload.body,
                icon: "icons/32x32.png",
                sound: "default",
                data: payload.data,
            });

            console.log("Notification sent successfully!");
        } catch (error) {
            console.error("Failed to send local notification:", error);
        }
    }

    /**
     * Unregister device from the provisioner service
     */
    async unregisterDevice(): Promise<boolean> {
        if (!this.deviceRegistration) {
            return true; // Already unregistered
        }

        try {
            const response = await fetch(
                `${this.provisionerEndpoint}/api/devices/unregister`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        eName: this.deviceRegistration.eName,
                        deviceId: this.deviceRegistration.deviceId,
                    }),
                },
            );

            if (response.ok) {
                this.deviceRegistration = null;
                console.log("Device unregistered successfully");
                return true;
            } else {
                throw new Error(
                    `Unregistration failed: ${response.statusText}`,
                );
            }
        } catch (error) {
            console.error("Failed to unregister device:", error);
            return false;
        }
    }

    /**
     * Check for notifications from provisioner and show them locally
     */
    async checkAndShowNotifications(): Promise<void> {
        try {
            console.log("🔍 Checking for notifications from provisioner...");

            // Get current device registration
            let registration = this.getDeviceRegistration();

            // If no registration, try to get eName from vault and register
            if (!registration) {
                console.log(
                    "No device registration found, attempting to register...",
                );

                // Try to get eName from vault
                try {
                    const vault = await this.getVaultEname();
                    if (vault?.ename) {
                        console.log(
                            `Found eName: ${vault.ename}, registering device...`,
                        );
                        const registered = await this.registerDevice(
                            vault.ename,
                        );
                        if (registered) {
                            registration = this.getDeviceRegistration();
                            console.log("Device registered successfully");
                        } else {
                            console.log("Failed to register device");
                            return;
                        }
                    } else {
                        console.log(
                            "No eName found in vault, skipping notification check",
                        );
                        return;
                    }
                } catch (error) {
                    console.error("Error getting vault eName:", error);
                    return;
                }
            }

            if (!registration) {
                console.log(
                    "Still no device registration, skipping notification check",
                );
                return;
            }

            // Check for notifications from provisioner
            const response = await fetch(
                `${this.provisionerEndpoint}/api/notifications/check`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        eName: registration.eName,
                        deviceId: registration.deviceId,
                    }),
                },
            );

            if (response.ok) {
                const data = await response.json();
                if (data.notifications && data.notifications.length > 0) {
                    console.log(
                        `📱 Found ${data.notifications.length} notification(s)`,
                    );

                    // Show each notification locally
                    for (const notification of data.notifications) {
                        await this.sendLocalNotification(notification);
                    }
                } else {
                    console.log("No new notifications");
                }
            } else {
                console.log(
                    "No notifications endpoint available or error:",
                    response.status,
                );
            }
        } catch (error) {
            console.error("Error checking notifications:", error);
        }
    }

    /**
     * Test notification - call this from browser console for debugging
     */
    async testNotification(): Promise<void> {
        console.log("🧪 Testing notification...");
        await this.sendLocalNotification({
            title: "Test Notification",
            body: "This is a test notification from eid-wallet!",
            data: { test: true, timestamp: new Date().toISOString() },
        });
    }

    /**
     * Get current device registration info
     */
    getDeviceRegistration(): DeviceRegistration | null {
        return this.deviceRegistration;
    }

    /**
     * Check if device is registered
     */
    isDeviceRegistered(): boolean {
        return this.deviceRegistration !== null;
    }

    /**
     * Get device ID (using Tauri's device ID or generating one)
     */
    private async getDeviceId(): Promise<string> {
        try {
            // Try to get device ID from Tauri
            const deviceId = await invoke<string>("get_device_id");
            return deviceId;
        } catch (error) {
            // Fallback to generating a UUID
            const { v4: uuidv4 } = await import("uuid");
            return uuidv4();
        }
    }

    /**
     * Get platform information
     */
    private async getPlatform(): Promise<"android" | "ios" | "desktop"> {
        try {
            const platform = await invoke<string>("get_platform");
            if (platform.includes("android")) return "android";
            if (platform.includes("ios")) return "ios";
            return "desktop";
        } catch (error) {
            // Fallback detection
            const userAgent = navigator.userAgent.toLowerCase();
            if (userAgent.includes("android")) return "android";
            if (userAgent.includes("iphone") || userAgent.includes("ipad"))
                return "ios";
            return "desktop";
        }
    }

    /**
     * Get FCM token for push notifications (mobile only)
     */
    private async getFCMToken(): Promise<string | undefined> {
        try {
            // This would need to be implemented with Firebase SDK
            // For now, return undefined as we're focusing on local notifications
            return undefined;
        } catch (error) {
            console.error("Failed to get FCM token:", error);
            return undefined;
        }
    }
    /**
     * Get eName from vault (helper method)
     */
    private async getVaultEname(): Promise<{ ename: string } | null> {
        try {
            // Try to access vault through global state or store
            // This is a simple approach - in a real app you might want to inject the vault controller
            const store = await import("@tauri-apps/plugin-store").then((m) =>
                m.Store.load("global-state.json"),
            );
            const vault = await store.get<{ ename: string }>("vault");
            return vault;
        } catch (error) {
            console.error("Error getting vault eName:", error);
            return null;
        }
    }
}

export default NotificationService;
