import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NotificationService } from "./NotificationService";
import { Verification } from "../entities/Verification";
import { Notification } from "../entities/Notification";
import { setupTestDatabase, teardownTestDatabase } from "../test-utils/postgres-setup";
import { DataSource } from "typeorm";
import { Repository } from "typeorm";

describe("NotificationService", () => {
    let dataSource: DataSource;
    let notificationService: NotificationService;
    let verificationRepository: Repository<Verification>;
    let notificationRepository: Repository<Notification>;

    beforeAll(async () => {
        const setup = await setupTestDatabase();
        dataSource = setup.dataSource;
        verificationRepository = dataSource.getRepository(Verification);
        notificationRepository = dataSource.getRepository(Notification);
        notificationService = new NotificationService(
            verificationRepository,
            notificationRepository
        );
    });

    afterAll(async () => {
        await teardownTestDatabase();
    });

    beforeEach(async () => {
        await verificationRepository.clear();
        await notificationRepository.clear();
    });

    describe("registerDevice", () => {
        it("should register new device", async () => {
            const registration = {
                eName: "test@example.com",
                deviceId: "device-123",
                platform: "android" as const,
                fcmToken: "fcm-token-123",
                registrationTime: new Date(),
            };

            const verification = await notificationService.registerDevice(registration);

            expect(verification).toBeDefined();
            expect(verification.linkedEName).toBe("test@example.com");
            expect(verification.deviceId).toBe("device-123");
            expect(verification.platform).toBe("android");
            expect(verification.fcmToken).toBe("fcm-token-123");
            expect(verification.deviceActive).toBe(true);
            expect(verification.approved).toBe(true);
        });

        it("should update existing device registration", async () => {
            const registration1 = {
                eName: "test@example.com",
                deviceId: "device-123",
                platform: "android" as const,
                registrationTime: new Date(),
            };

            await notificationService.registerDevice(registration1);

            const registration2 = {
                ...registration1,
                fcmToken: "new-fcm-token",
                platform: "ios" as const,
            };

            const verification = await notificationService.registerDevice(registration2);

            expect(verification.deviceId).toBe("device-123");
            expect(verification.platform).toBe("ios");
            expect(verification.fcmToken).toBe("new-fcm-token");
        });
    });

    describe("unregisterDevice", () => {
        it("should mark device as inactive", async () => {
            const registration = {
                eName: "test@example.com",
                deviceId: "device-123",
                platform: "android" as const,
                registrationTime: new Date(),
            };

            await notificationService.registerDevice(registration);
            const success = await notificationService.unregisterDevice(
                "test@example.com",
                "device-123"
            );

            expect(success).toBe(true);

            const devices = await notificationService.getDevicesByEName("test@example.com");
            expect(devices).toHaveLength(0);
        });

        it("should return false when device does not exist", async () => {
            const success = await notificationService.unregisterDevice(
                "nonexistent@example.com",
                "device-123"
            );

            expect(success).toBe(false);
        });
    });

    describe("getDevicesByEName", () => {
        it("should retrieve active devices for eName", async () => {
            await notificationService.registerDevice({
                eName: "test@example.com",
                deviceId: "device-1",
                platform: "android",
                registrationTime: new Date(),
            });

            await notificationService.registerDevice({
                eName: "test@example.com",
                deviceId: "device-2",
                platform: "ios",
                registrationTime: new Date(),
            });

            const devices = await notificationService.getDevicesByEName("test@example.com");

            expect(devices).toHaveLength(2);
            expect(devices.map(d => d.deviceId)).toContain("device-1");
            expect(devices.map(d => d.deviceId)).toContain("device-2");
        });

        it("should not return inactive devices", async () => {
            await notificationService.registerDevice({
                eName: "test@example.com",
                deviceId: "device-1",
                platform: "android",
                registrationTime: new Date(),
            });

            await notificationService.unregisterDevice("test@example.com", "device-1");

            const devices = await notificationService.getDevicesByEName("test@example.com");
            expect(devices).toHaveLength(0);
        });
    });

    describe("sendNotificationToEName", () => {
        it("should create notification in DB when devices exist", async () => {
            await notificationService.registerDevice({
                eName: "test@example.com",
                deviceId: "device-1",
                platform: "android",
                registrationTime: new Date(),
            });

            const success = await notificationService.sendNotificationToEName(
                "test@example.com",
                {
                    title: "Test Notification",
                    body: "Test body",
                    data: { type: "test" },
                }
            );

            expect(success).toBe(true);

            const notifications = await notificationService.getUndeliveredNotifications("test@example.com");
            expect(notifications).toHaveLength(1);
            expect(notifications[0].title).toBe("Test Notification");
            expect(notifications[0].body).toBe("Test body");
        });

        it("should return false when no active devices found", async () => {
            const success = await notificationService.sendNotificationToEName(
                "nonexistent@example.com",
                {
                    title: "Test",
                    body: "Test body",
                }
            );

            expect(success).toBe(false);
        });
    });

    describe("getUndeliveredNotifications", () => {
        it("should retrieve undelivered notifications", async () => {
            await notificationService.registerDevice({
                eName: "test@example.com",
                deviceId: "device-1",
                platform: "android",
                registrationTime: new Date(),
            });

            await notificationService.sendNotificationToEName("test@example.com", {
                title: "Notification 1",
                body: "Body 1",
            });

            await notificationService.sendNotificationToEName("test@example.com", {
                title: "Notification 2",
                body: "Body 2",
            });

            const notifications = await notificationService.getUndeliveredNotifications(
                "test@example.com"
            );

            expect(notifications).toHaveLength(2);
            expect(notifications[0].delivered).toBe(false);
        });

        it("should not return delivered notifications", async () => {
            await notificationService.registerDevice({
                eName: "test@example.com",
                deviceId: "device-1",
                platform: "android",
                registrationTime: new Date(),
            });

            await notificationService.sendNotificationToEName("test@example.com", {
                title: "Notification",
                body: "Body",
            });

            const notifications = await notificationService.getUndeliveredNotifications(
                "test@example.com"
            );
            expect(notifications).toHaveLength(1);

            await notificationService.markNotificationAsDelivered(notifications[0].id);

            const undelivered = await notificationService.getUndeliveredNotifications(
                "test@example.com"
            );
            expect(undelivered).toHaveLength(0);
        });
    });

    describe("markNotificationAsDelivered", () => {
        it("should mark notification as delivered", async () => {
            await notificationService.registerDevice({
                eName: "test@example.com",
                deviceId: "device-1",
                platform: "android",
                registrationTime: new Date(),
            });

            await notificationService.sendNotificationToEName("test@example.com", {
                title: "Test",
                body: "Body",
            });

            const notifications = await notificationService.getUndeliveredNotifications(
                "test@example.com"
            );
            await notificationService.markNotificationAsDelivered(notifications[0].id);

            const notification = await notificationRepository.findOne({
                where: { id: notifications[0].id },
            });

            expect(notification?.delivered).toBe(true);
            expect(notification?.deliveredAt).toBeDefined();
        });
    });

    describe("getDeviceStats", () => {
        it("should aggregate device statistics", async () => {
            await notificationService.registerDevice({
                eName: "test1@example.com",
                deviceId: "device-1",
                platform: "android",
                registrationTime: new Date(),
            });

            await notificationService.registerDevice({
                eName: "test2@example.com",
                deviceId: "device-2",
                platform: "ios",
                registrationTime: new Date(),
            });

            await notificationService.registerDevice({
                eName: "test3@example.com",
                deviceId: "device-3",
                platform: "android",
                registrationTime: new Date(),
            });

            const stats = await notificationService.getDeviceStats();

            expect(stats.totalDevices).toBe(3);
            expect(stats.devicesByPlatform.android).toBe(2);
            expect(stats.devicesByPlatform.ios).toBe(1);
        });
    });
});

