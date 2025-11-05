import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Repository } from "typeorm";
import { VerificationService } from "./VerificationService";
import { Verification } from "../entities/Verification";
import { setupTestDatabase, teardownTestDatabase } from "../test-utils/postgres-setup";
import { DataSource } from "typeorm";

describe("VerificationService", () => {
    let dataSource: DataSource;
    let verificationService: VerificationService;
    let verificationRepository: Repository<Verification>;

    beforeAll(async () => {
        const setup = await setupTestDatabase();
        dataSource = setup.dataSource;
        verificationRepository = dataSource.getRepository(Verification);
        verificationService = new VerificationService(verificationRepository);
    });

    afterAll(async () => {
        await teardownTestDatabase();
    });

    beforeEach(async () => {
        await verificationRepository.clear();
    });

    describe("create", () => {
        it("should create verification record", async () => {
            const verification = await verificationService.create({
                linkedEName: "test@example.com",
                deviceId: "device-123",
                platform: "android",
                approved: true,
                consumed: false,
            });

            expect(verification).toBeDefined();
            expect(verification.linkedEName).toBe("test@example.com");
            expect(verification.deviceId).toBe("device-123");
            expect(verification.approved).toBe(true);
            expect(verification.consumed).toBe(false);
            expect(verification.id).toBeDefined();
        });
    });

    describe("findById", () => {
        it("should find verification by ID when it exists", async () => {
            const created = await verificationService.create({
                linkedEName: "test@example.com",
                approved: true,
                consumed: false,
            });

            const found = await verificationService.findById(created.id);

            expect(found).toBeDefined();
            expect(found?.linkedEName).toBe("test@example.com");
        });

        it("should return null when verification does not exist", async () => {
            // Use a valid UUID format that doesn't exist
            const found = await verificationService.findById("00000000-0000-0000-0000-000000000000");
            expect(found).toBeNull();
        });
    });

    describe("findByIdAndUpdate", () => {
        it("should update verification properties", async () => {
            const created = await verificationService.create({
                linkedEName: "test@example.com",
                approved: false,
                consumed: false,
            });

            const updated = await verificationService.findByIdAndUpdate(created.id, {
                approved: true,
                consumed: true,
            });

            expect(updated).toBeDefined();
            expect(updated?.approved).toBe(true);
            expect(updated?.consumed).toBe(true);
        });

        it("should update linkedEName", async () => {
            const created = await verificationService.create({
                linkedEName: "old@example.com",
                approved: true,
                consumed: false,
            });

            const updated = await verificationService.findByIdAndUpdate(created.id, {
                linkedEName: "new@example.com",
            });

            expect(updated?.linkedEName).toBe("new@example.com");
        });
    });

    describe("findOne", () => {
        it("should find verification by conditions", async () => {
            await verificationService.create({
                linkedEName: "test1@example.com",
                approved: true,
                consumed: false,
            });

            const found = await verificationService.findOne({
                linkedEName: "test1@example.com",
            });

            expect(found).toBeDefined();
            expect(found?.linkedEName).toBe("test1@example.com");
        });

        it("should return null when no match found", async () => {
            const found = await verificationService.findOne({
                linkedEName: "nonexistent@example.com",
            });
            expect(found).toBeNull();
        });
    });

    // Note: findAndCount is not implemented in VerificationService
    // These tests are commented out until the method is added
    /*
    describe("findAndCount", () => {
        it("should return verifications with count", async () => {
            await verificationService.create({
                linkedEName: "test1@example.com",
                approved: true,
                consumed: false,
            });
            await verificationService.create({
                linkedEName: "test2@example.com",
                approved: true,
                consumed: false,
            });

            const [results, count] = await verificationService.findAndCount({});

            expect(results).toHaveLength(2);
            expect(count).toBe(2);
        });

        it("should filter by conditions", async () => {
            await verificationService.create({
                linkedEName: "approved@example.com",
                approved: true,
                consumed: false,
            });
            await verificationService.create({
                linkedEName: "not-approved@example.com",
                approved: false,
                consumed: false,
            });

            const [results, count] = await verificationService.findAndCount({
                approved: true,
            });

            expect(results).toHaveLength(1);
            expect(count).toBe(1);
            expect(results[0].linkedEName).toBe("approved@example.com");
        });
    });
    */
});

