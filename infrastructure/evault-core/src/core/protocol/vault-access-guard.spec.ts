import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { VaultAccessGuard, VaultContext } from "./vault-access-guard";
import { DbService } from "../db/db.service";
import { setupTestNeo4j, teardownTestNeo4j } from "../../test-utils/neo4j-setup";
import { Driver } from "neo4j-driver";
import axios from "axios";
import * as jose from "jose";
import { SignJWT, generateKeyPair, exportJWK } from "jose";

vi.mock("axios");
const mockedAxios = axios as any;

describe("VaultAccessGuard", () => {
    let driver: Driver;
    let dbService: DbService;
    let guard: VaultAccessGuard;
    let testPrivateKey: any;
    let testPublicKey: any;
    let testJWK: any;

    beforeAll(async () => {
        const setup = await setupTestNeo4j();
        driver = setup.driver;
        dbService = new DbService(driver);
        guard = new VaultAccessGuard(dbService);

        // Generate test keys for JWT signing
        const { publicKey, privateKey } = await generateKeyPair("ES256", {
            extractable: true,
        });

        testPrivateKey = privateKey;
        testPublicKey = publicKey;
        testJWK = await exportJWK(privateKey);
        testJWK.kid = "entropy-key-1";
        testJWK.alg = "ES256";
        testJWK.use = "sig";

        process.env.REGISTRY_URL = "http://localhost:4322";
    }, 120000);

    afterAll(async () => {
        await teardownTestNeo4j();
        delete process.env.REGISTRY_URL;
    });

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock JWKS endpoint
        mockedAxios.get.mockResolvedValue({
            data: {
                keys: [{ ...testJWK, d: undefined }], // Public key only
            },
        });
    });

    const createMockContext = (overrides: Partial<VaultContext> = {}): VaultContext => {
        return {
            request: {
                headers: new Headers(overrides.request?.headers || {}),
            },
            currentUser: overrides.currentUser || null,
            eName: overrides.eName || null,
            ...overrides,
        } as VaultContext;
    };

    const createValidToken = async (payload: any = {}): Promise<string> => {
        return await new SignJWT(payload)
            .setProtectedHeader({ alg: "ES256", kid: "entropy-key-1" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(testPrivateKey);
    };

    describe("validateToken", () => {
        it("should validate valid JWT token", async () => {
            const token = await createValidToken({ platform: "test-platform" });
            const context = createMockContext({
                request: {
                    headers: new Headers({
                        authorization: `Bearer ${token}`,
                    }),
                },
            });

            // Access private method through reflection for testing
            const validateToken = (guard as any).validateToken.bind(guard);
            const result = await validateToken(`Bearer ${token}`);

            expect(result).toBeDefined();
            expect(result.platform).toBe("test-platform");
        });

        it("should return null for invalid token", async () => {
            const validateToken = (guard as any).validateToken.bind(guard);
            const result = await validateToken("Bearer invalid-token");

            expect(result).toBeNull();
        });

        it("should return null for missing token", async () => {
            const validateToken = (guard as any).validateToken.bind(guard);
            const result = await validateToken(null);

            expect(result).toBeNull();
        });

        it("should return null when REGISTRY_URL is not set", async () => {
            const originalUrl = process.env.REGISTRY_URL;
            delete process.env.REGISTRY_URL;

            const validateToken = (guard as any).validateToken.bind(guard);
            const result = await validateToken("Bearer token");

            expect(result).toBeNull();

            process.env.REGISTRY_URL = originalUrl;
        });
    });

    describe("checkAccess", () => {
        it("should allow access with valid token", async () => {
            const token = await createValidToken({ platform: "test-platform" });
            const context = createMockContext({
                request: {
                    headers: new Headers({
                        authorization: `Bearer ${token}`,
                    }),
                },
                eName: "test@example.com",
            });

            const checkAccess = (guard as any).checkAccess.bind(guard);
            const result = await checkAccess("meta-envelope-id", context);

            expect(result).toBe(true);
            expect(context.tokenPayload).toBeDefined();
        });

        it("should allow access with ACL '*'", async () => {
            const eName = "test@example.com";
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "Test",
                    payload: { field: "value" },
                },
                ["*"],
                eName
            );

            const context = createMockContext({
                eName,
                currentUser: "user-123",
            });

            const checkAccess = (guard as any).checkAccess.bind(guard);
            const result = await checkAccess(metaEnvelope.metaEnvelope.id, context);

            expect(result).toBe(true);
        });

        it("should allow access when user is in ACL", async () => {
            const eName = "test@example.com";
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "Test",
                    payload: { field: "value" },
                },
                ["user-123"],
                eName
            );

            const context = createMockContext({
                eName,
                currentUser: "user-123",
            });

            const checkAccess = (guard as any).checkAccess.bind(guard);
            const result = await checkAccess(metaEnvelope.metaEnvelope.id, context);

            expect(result).toBe(true);
        });

        it("should deny access when user is not in ACL", async () => {
            const eName = "test@example.com";
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "Test",
                    payload: { field: "value" },
                },
                ["other-user"],
                eName
            );

            const context = createMockContext({
                eName,
                currentUser: "user-123",
            });

            const checkAccess = (guard as any).checkAccess.bind(guard);
            const result = await checkAccess(metaEnvelope.metaEnvelope.id, context);

            expect(result).toBe(false);
        });

        it("should throw error when eName header is missing", async () => {
            const context = createMockContext({
                currentUser: "user-123",
                // eName is null
            });

            const checkAccess = (guard as any).checkAccess.bind(guard);
            
            await expect(checkAccess("meta-envelope-id", context)).rejects.toThrow(
                "X-ENAME header is required"
            );
        });

        it("should allow access with ACL '*' even without currentUser", async () => {
            const eName = "test@example.com";
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "Test",
                    payload: { field: "value" },
                },
                ["*"],
                eName
            );

            const context = createMockContext({
                eName,
                currentUser: null,
            });

            const checkAccess = (guard as any).checkAccess.bind(guard);
            const result = await checkAccess(metaEnvelope.metaEnvelope.id, context);

            expect(result).toBe(true);
        });
    });

    describe("middleware", () => {
        it("should filter ACL from responses", async () => {
            const eName = "test@example.com";
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "Test",
                    payload: { field: "value" },
                },
                ["user-123"],
                eName
            );

            const context = createMockContext({
                eName,
                currentUser: "user-123",
            });

            const mockResolver = vi.fn(async () => {
                const result = await dbService.findMetaEnvelopeById(
                    metaEnvelope.metaEnvelope.id,
                    eName
                );
                return result;
            });

            const wrappedResolver = guard.middleware(mockResolver);
            const result = await wrappedResolver(null, { id: metaEnvelope.metaEnvelope.id }, context);

            expect(result).toBeDefined();
            expect(result.acl).toBeUndefined(); // ACL should be filtered
        });

        it("should throw error when access is denied", async () => {
            const eName = "test@example.com";
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "Test",
                    payload: { field: "value" },
                },
                ["other-user"],
                eName
            );

            const context = createMockContext({
                eName,
                currentUser: "user-123",
            });

            const mockResolver = vi.fn(async () => {
                return await dbService.findMetaEnvelopeById(metaEnvelope.metaEnvelope.id, eName);
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            await expect(
                wrappedResolver(null, { id: metaEnvelope.metaEnvelope.id }, context)
            ).rejects.toThrow("Access denied");
        });
    });
});

