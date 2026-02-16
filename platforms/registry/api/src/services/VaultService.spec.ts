import { Repository } from "typeorm";
import { VaultService } from "./VaultService";
import { Vault } from "../entities/Vault";
import { setupTestDatabase, teardownTestDatabase } from "../test-utils/postgres-setup";
import { DataSource } from "typeorm";

describe("VaultService", () => {
    let dataSource: DataSource;
    let vaultService: VaultService;
    let vaultRepository: Repository<Vault>;

    beforeAll(async () => {
        const setup = await setupTestDatabase();
        dataSource = setup.dataSource;
        vaultRepository = dataSource.getRepository(Vault);
        vaultService = new VaultService(vaultRepository);
    });

    afterAll(async () => {
        await teardownTestDatabase();
    });

    beforeEach(async () => {
        await vaultRepository.clear();
    });

    describe("create", () => {
        it("should create a vault entry with valid data", async () => {
            const vault = await vaultService.create(
                "test@example.com",
                "http://localhost:4000",
                "evault-w3id-123"
            );

            expect(vault).toBeDefined();
            expect(vault.ename).toBe("test@example.com");
            expect(vault.uri).toBe("http://localhost:4000");
            expect(vault.evault).toBe("evault-w3id-123");
            expect(vault.id).toBeDefined();
        });
    });

    describe("findAll", () => {
        it("should retrieve all vaults", async () => {
            await vaultService.create("test1@example.com", "http://localhost:4000", "evault-1");
            await vaultService.create("test2@example.com", "http://localhost:4001", "evault-2");

            const vaults = await vaultService.findAll();

            expect(vaults).toHaveLength(2);
            expect(vaults.map(v => v.ename)).toContain("test1@example.com");
            expect(vaults.map(v => v.ename)).toContain("test2@example.com");
        });

        it("should return empty array when no vaults exist", async () => {
            const vaults = await vaultService.findAll();
            expect(vaults).toHaveLength(0);
        });
    });

    describe("findOne", () => {
        it("should find vault by ID when it exists", async () => {
            const created = await vaultService.create(
                "test@example.com",
                "http://localhost:4000",
                "evault-123"
            );

            const found = await vaultService.findOne(created.id);

            expect(found).toBeDefined();
            expect(found?.ename).toBe("test@example.com");
            expect(found?.uri).toBe("http://localhost:4000");
        });

        it("should return null when vault does not exist", async () => {
            const found = await vaultService.findOne(999);
            expect(found).toBeNull();
        });
    });

    describe("findByEname", () => {
        it("should find vault by eName when it exists", async () => {
            await vaultService.create(
                "test@example.com",
                "http://localhost:4000",
                "evault-123"
            );

            const found = await vaultService.findByEname("test@example.com");

            expect(found).toBeDefined();
            expect(found?.ename).toBe("test@example.com");
        });

        it("should return null when eName does not exist", async () => {
            const found = await vaultService.findByEname("nonexistent@example.com");
            expect(found).toBeNull();
        });
    });

    describe("update", () => {
        it("should update vault properties", async () => {
            const created = await vaultService.create(
                "test@example.com",
                "http://localhost:4000",
                "evault-123"
            );

            const updated = await vaultService.update(created.id, {
                uri: "http://localhost:5000",
            });

            expect(updated).toBeDefined();
            expect(updated?.uri).toBe("http://localhost:5000");
            expect(updated?.ename).toBe("test@example.com"); // unchanged
        });

        it("should return null when updating non-existent vault", async () => {
            const updated = await vaultService.update(999, { uri: "http://localhost:5000" });
            expect(updated).toBeNull();
        });
    });

    describe("delete", () => {
        it("should delete vault entry", async () => {
            const created = await vaultService.create(
                "test@example.com",
                "http://localhost:4000",
                "evault-123"
            );

            await vaultService.delete(created.id);

            const found = await vaultService.findOne(created.id);
            expect(found).toBeNull();
        });

        it("should not throw when deleting non-existent vault", async () => {
            await expect(vaultService.delete(999)).resolves.not.toThrow();
        });
    });
});

