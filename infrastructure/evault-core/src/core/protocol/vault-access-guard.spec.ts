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
        const mockRequest = {
            headers: new Headers(overrides.request?.headers || {}),
        } as any;
        return {
            request: mockRequest,
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
                } as any,
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
                } as any,
                eName: "test@example.com",
            });

            const checkAccess = (guard as any).checkAccess.bind(guard);
            const result = await checkAccess("meta-envelope-id", context);

            expect(result.hasAccess).toBe(true);
            expect(context.tokenPayload).toBeDefined();
        });

        it("should allow access with ACL '*'", async () => {
            const eName = "test@example.com";
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "Test",
                    payload: { field: "value" },
                    acl: ["*"],
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

            expect(result.hasAccess).toBe(true);
        });

        it("should allow access when user is in ACL", async () => {
            const eName = "test@example.com";
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "Test",
                    payload: { field: "value" },
                    acl: ["user-123"],
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

            expect(result.hasAccess).toBe(true);
        });

        it("should deny access when user is not in ACL", async () => {
            const eName = "test@example.com";
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "Test",
                    payload: { field: "value" },
                    acl: ["other-user"],
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

            expect(result.hasAccess).toBe(false);
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

        it("should prevent access to meta-envelopes from different eName (data leak prevention)", async () => {
            const eName1 = "tenant1@example.com";
            const eName2 = "tenant2@example.com";
            
            // Create meta-envelope for tenant1
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "SecretData",
                    payload: { secret: "tenant1-secret-value" },
                    acl: ["*"], // Public ACL
                },
                ["*"], // Public ACL
                eName1
            );

            // Try to access tenant1's data with tenant2's eName
            const context = createMockContext({
                eName: eName2, // Different eName!
                currentUser: "user-123",
            });

            const checkAccess = (guard as any).checkAccess.bind(guard);
            
            // Should return false because the meta-envelope won't be found with eName2
            const result = await checkAccess(metaEnvelope.metaEnvelope.id, context);
            expect(result.hasAccess).toBe(false);
            expect(result.exists).toBe(false);
        });

        it("should allow access only to meta-envelopes matching the provided eName", async () => {
            const eName1 = "tenant1@example.com";
            const eName2 = "tenant2@example.com";
            
            // Create meta-envelopes for both tenants
            const metaEnvelope1 = await dbService.storeMetaEnvelope(
                {
                    ontology: "Tenant1Data",
                    payload: { data: "tenant1-data" },
                    acl: ["*"],
                },
                ["*"],
                eName1
            );

            const metaEnvelope2 = await dbService.storeMetaEnvelope(
                {
                    ontology: "Tenant2Data",
                    payload: { data: "tenant2-data" },
                    acl: ["*"],
                },
                ["*"],
                eName2
            );

            // Tenant1 should only access their own data
            const context1 = createMockContext({
                eName: eName1,
                currentUser: "user-123",
            });

            const checkAccess = (guard as any).checkAccess.bind(guard);
            
            const result1 = await checkAccess(metaEnvelope1.metaEnvelope.id, context1);
            expect(result1.hasAccess).toBe(true);

            // Tenant1 should NOT access tenant2's data
            const result2 = await checkAccess(metaEnvelope2.metaEnvelope.id, context1);
            expect(result2.hasAccess).toBe(false);

            // Tenant2 should only access their own data
            const context2 = createMockContext({
                eName: eName2,
                currentUser: "user-123",
            });

            const result3 = await checkAccess(metaEnvelope2.metaEnvelope.id, context2);
            expect(result3.hasAccess).toBe(true);

            // Tenant2 should NOT access tenant1's data
            const result4 = await checkAccess(metaEnvelope1.metaEnvelope.id, context2);
            expect(result4.hasAccess).toBe(false);
        });

        it("should allow access with ACL '*' even without currentUser", async () => {
            const eName = "test@example.com";
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "Test",
                    payload: { field: "value" },
                    acl: ["*"],
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

            expect(result.hasAccess).toBe(true);
            expect(result.exists).toBe(true);
        });
    });

    describe("middleware", () => {
        it("should filter ACL from responses", async () => {
            const eName = "test@example.com";
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "Test",
                    payload: { field: "value" },
                    acl: ["user-123"],
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
                    acl: ["other-user"],
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

        it("should prevent data leak when accessing with wrong eName in middleware", async () => {
            const eName1 = "tenant1@example.com";
            const eName2 = "tenant2@example.com";
            
            // Create meta-envelope for tenant1
            const metaEnvelope = await dbService.storeMetaEnvelope(
                {
                    ontology: "SecretData",
                    payload: { secret: "tenant1-secret" },
                    acl: ["*"], // Public ACL
                },
                ["*"], // Public ACL
                eName1
            );

            // Try to access with tenant2's eName
            const context = createMockContext({
                eName: eName2, // Wrong eName!
                currentUser: "user-123",
            });

            const mockResolver = vi.fn(async () => {
                // Resolver tries to fetch with the context's eName
                return await dbService.findMetaEnvelopeById(
                    metaEnvelope.metaEnvelope.id,
                    eName2 // Using wrong eName
                );
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            // When envelope doesn't exist (wrong eName), middleware returns null (not found)
            const result = await wrappedResolver(null, { id: metaEnvelope.metaEnvelope.id }, context);
            expect(result).toBeNull();
        });
    });

    describe("Authentication Validation (Security Tests)", () => {
        it("should reject getAllEnvelopes without authentication (no token, no eName)", async () => {
            const context = createMockContext({
                // No eName, no token
                eName: null,
                request: {
                    headers: new Headers({}),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return [{ id: "envelope-1", ontology: "Test", value: { data: "secret" } }];
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            await expect(
                wrappedResolver(null, {}, context)
            ).rejects.toThrow("Authentication required");
            
            // CRITICAL: Resolver should NOT be executed
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should reject getAllEnvelopes with empty eName", async () => {
            const context = createMockContext({
                eName: "",
                request: {
                    headers: new Headers({}),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return [{ id: "envelope-1", ontology: "Test", value: { data: "secret" } }];
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            // Empty string is falsy, so it will throw the first authentication error
            await expect(
                wrappedResolver(null, {}, context)
            ).rejects.toThrow("Authentication required");
            
            // CRITICAL: Resolver should NOT be executed
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should reject getAllEnvelopes with whitespace-only eName", async () => {
            const context = createMockContext({
                eName: "   ",
                request: {
                    headers: new Headers({}),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return [{ id: "envelope-1", ontology: "Test", value: { data: "secret" } }];
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            // Whitespace-only string will be caught by the trim check
            await expect(
                wrappedResolver(null, {}, context)
            ).rejects.toThrow("Invalid X-ENAME header");
            
            // CRITICAL: Resolver should NOT be executed
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should allow getAllEnvelopes with valid eName", async () => {
            const eName = "test@example.com";
            const context = createMockContext({
                eName,
                request: {
                    headers: new Headers({}),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return [{ id: "envelope-1", ontology: "Test", value: { data: "test" } }];
            });

            const wrappedResolver = guard.middleware(mockResolver);
            const result = await wrappedResolver(null, {}, context);
            
            // Should execute and return results
            expect(result).toBeDefined();
            expect(mockResolver).toHaveBeenCalled();
        });

        it("should allow getAllEnvelopes with valid Bearer token", async () => {
            const token = await createValidToken({ platform: "test-platform" });
            const context = createMockContext({
                eName: null,
                request: {
                    headers: new Headers({
                        authorization: `Bearer ${token}`,
                    }),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return [{ id: "envelope-1", ontology: "Test", value: { data: "test" } }];
            });

            const wrappedResolver = guard.middleware(mockResolver);
            const result = await wrappedResolver(null, {}, context);
            
            // Should execute and return results
            expect(result).toBeDefined();
            expect(mockResolver).toHaveBeenCalled();
            expect(context.tokenPayload).toBeDefined();
        });

        it("should reject findMetaEnvelopesByOntology without authentication", async () => {
            const context = createMockContext({
                eName: null,
                request: {
                    headers: new Headers({}),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return [{ id: "envelope-1", ontology: "Test", acl: ["*"] }];
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            await expect(
                wrappedResolver(null, { ontology: "Test" }, context)
            ).rejects.toThrow("Authentication required");
            
            // CRITICAL: Resolver should NOT be executed
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should reject searchMetaEnvelopes without authentication", async () => {
            const context = createMockContext({
                eName: null,
                request: {
                    headers: new Headers({}),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return [{ id: "envelope-1", ontology: "Test", acl: ["*"] }];
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            await expect(
                wrappedResolver(null, { ontology: "Test", term: "search" }, context)
            ).rejects.toThrow("Authentication required");
            
            // CRITICAL: Resolver should NOT be executed
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should reject storeMetaEnvelope mutation without authentication", async () => {
            const context = createMockContext({
                eName: null,
                request: {
                    headers: new Headers({}),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return {
                    metaEnvelope: { id: "new-envelope", ontology: "Test" },
                    envelopes: [],
                };
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            await expect(
                wrappedResolver(null, { input: { ontology: "Test", payload: {}, acl: [] } }, context)
            ).rejects.toThrow("Authentication required");
            
            // CRITICAL: Resolver should NOT be executed
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should reject deleteMetaEnvelope mutation without authentication", async () => {
            const context = createMockContext({
                eName: null,
                request: {
                    headers: new Headers({}),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return true;
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            await expect(
                wrappedResolver(null, { id: "envelope-id" }, context)
            ).rejects.toThrow("Authentication required");
            
            // CRITICAL: Resolver should NOT be executed
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should reject updateEnvelopeValue mutation without authentication", async () => {
            const context = createMockContext({
                eName: null,
                request: {
                    headers: new Headers({}),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return true;
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            await expect(
                wrappedResolver(null, { envelopeId: "envelope-id", newValue: {} }, context)
            ).rejects.toThrow("Authentication required");
            
            // CRITICAL: Resolver should NOT be executed
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should reject getMetaEnvelopeById without authentication", async () => {
            const context = createMockContext({
                eName: null,
                request: {
                    headers: new Headers({}),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return { id: "envelope-1", ontology: "Test", acl: ["*"] };
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            await expect(
                wrappedResolver(null, { id: "envelope-id" }, context)
            ).rejects.toThrow("Authentication required");
            
            // CRITICAL: Resolver should NOT be executed
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should allow operations with valid eName even without token", async () => {
            const eName = "test@example.com";
            const context = createMockContext({
                eName,
                request: {
                    headers: new Headers({}),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return [{ id: "envelope-1", ontology: "Test", value: {} }];
            });

            const wrappedResolver = guard.middleware(mockResolver);
            const result = await wrappedResolver(null, {}, context);
            
            // Should execute successfully
            expect(result).toBeDefined();
            expect(mockResolver).toHaveBeenCalled();
        });

        it("should allow operations with valid token even without eName", async () => {
            const token = await createValidToken({ platform: "test-platform" });
            const context = createMockContext({
                eName: null,
                request: {
                    headers: new Headers({
                        authorization: `Bearer ${token}`,
                    }),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return [{ id: "envelope-1", ontology: "Test", value: {} }];
            });

            const wrappedResolver = guard.middleware(mockResolver);
            const result = await wrappedResolver(null, {}, context);
            
            // Should execute successfully
            expect(result).toBeDefined();
            expect(mockResolver).toHaveBeenCalled();
            expect(context.tokenPayload).toBeDefined();
        });

        it("should reject with invalid Bearer token format", async () => {
            const context = createMockContext({
                eName: null,
                request: {
                    headers: new Headers({
                        authorization: "InvalidFormat token",
                    }),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return [{ id: "envelope-1", ontology: "Test", value: {} }];
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            await expect(
                wrappedResolver(null, {}, context)
            ).rejects.toThrow("Authentication required");
            
            // CRITICAL: Resolver should NOT be executed
            expect(mockResolver).not.toHaveBeenCalled();
        });
    });
});

