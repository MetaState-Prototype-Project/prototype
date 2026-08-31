import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { VaultAccessGuard, VaultContext } from "./vault-access-guard";
import { GroupMembershipService, Permission } from "../acl";
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
        mockedAxios.post.mockResolvedValue({ data: { managed: false, allowed: true } });
        process.env.REGISTRY_SHARED_SECRET = "registry-secret";
    });

    describe("managed PlatformProfile writes", () => {
        const profileInput = {
            ontology: "550e8400-e29b-41d4-a716-446655440000",
            payload: { platformName: "example" },
            acl: ["*"],
        };

        it("rejects a revoked legacy token before the resolver runs", async () => {
            mockedAxios.post.mockResolvedValue({
                data: { managed: true, allowed: false, reason: "The legacy platform token was revoked during migration" },
            });
            const resolver = vi.fn(async () => ({ id: "profile" }));
            const wrapped = guard.middleware(resolver);
            const context = createMockContext({
                eName: "@platform",
                request: { headers: new Headers({ authorization: "Bearer legacy-token" }) } as any,
            });

            await expect(wrapped(null, { id: "profile-1", input: profileInput }, context)).rejects.toThrow("revoked during migration");
            expect(resolver).not.toHaveBeenCalled();
        });

        it("allows the active manager token at the original envelope", async () => {
            mockedAxios.post.mockResolvedValue({ data: { managed: true, allowed: true } });
            const resolver = vi.fn(async () => ({ id: "profile" }));
            const wrapped = guard.middleware(resolver);
            const managerToken = await createValidToken({
                platform: "manager-a",
                kind: "platform-manager",
                managedEname: "@platform",
                manager: "manager-a",
            });
            const context = createMockContext({
                eName: "@platform",
                request: { headers: new Headers({ authorization: `Bearer ${managerToken}` }) } as any,
            });
            mockedAxios.get.mockResolvedValue({ data: { keys: [{ ...testJWK, d: undefined }] } });

            await wrapped(null, { id: "profile-1", input: profileInput }, context);
            expect(mockedAxios.post).toHaveBeenCalledWith(
                "http://localhost:4322/platforms/management/authorize-profile-write",
                expect.objectContaining({ ename: "@platform", envelopeId: "profile-1", token: managerToken }),
                expect.anything(),
            );
            expect(resolver).toHaveBeenCalledOnce();
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
            const token = await createValidToken({ platform: "test-platform" });
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
                request: {
                    headers: new Headers({
                        authorization: `Bearer ${token}`,
                    }),
                } as any,
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

        it("should allow access with valid Bearer token even when user is not in ACL (tokens bypass ACL)", async () => {
            const token = await createValidToken({ platform: "test-platform" });
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
                request: {
                    headers: new Headers({
                        authorization: `Bearer ${token}`,
                    }),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return await dbService.findMetaEnvelopeById(metaEnvelope.metaEnvelope.id, eName);
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            // Valid Bearer tokens bypass ACL checks (platform tokens have elevated privileges)
            const result = await wrappedResolver(null, { id: metaEnvelope.metaEnvelope.id }, context);
            expect(result).toBeDefined();
            expect(result.acl).toBeUndefined(); // ACL should be filtered
            expect(mockResolver).toHaveBeenCalled();
        });

        it("should throw error when access is denied (without Bearer token, ACL is enforced)", async () => {
            // Note: This test can't actually run because we now require Bearer tokens for all operations
            // except storeMetaEnvelope. This test documents the intended ACL behavior if tokens weren't required.
            // In practice, valid Bearer tokens bypass ACL checks.
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

            // This would fail authentication before ACL check
            const context = createMockContext({
                eName,
                currentUser: "user-123",
                request: {
                    headers: new Headers({}),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return await dbService.findMetaEnvelopeById(metaEnvelope.metaEnvelope.id, eName);
            });

            const wrappedResolver = guard.middleware(mockResolver);
            
            // Will fail at authentication step (no Bearer token)
            await expect(
                wrappedResolver(null, { id: metaEnvelope.metaEnvelope.id }, context)
            ).rejects.toThrow("Authentication required");
            
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should prevent data leak when accessing with wrong eName in middleware", async () => {
            const token = await createValidToken({ platform: "test-platform" });
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
                request: {
                    headers: new Headers({
                        authorization: `Bearer ${token}`,
                    }),
                } as any,
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
            
            // Will fail at authentication check first (no Bearer token required)
            await expect(
                wrappedResolver(null, {}, context)
            ).rejects.toThrow("Authentication required");
            
            // CRITICAL: Resolver should NOT be executed
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should reject getAllEnvelopes with only eName (no Bearer token)", async () => {
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
            
            await expect(
                wrappedResolver(null, {}, context)
            ).rejects.toThrow("Authentication required");
            
            // CRITICAL: Resolver should NOT be executed - eName alone is NOT sufficient
            expect(mockResolver).not.toHaveBeenCalled();
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

        it("should allow storeMetaEnvelope with only X-ENAME (no Bearer token required)", async () => {
            const eName = "test@example.com";
            const context = createMockContext({
                eName,
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
            const result = await wrappedResolver(null, { input: { ontology: "Test", payload: {}, acl: [] } }, context);
            
            // Should execute successfully - storeMetaEnvelope only requires X-ENAME
            expect(result).toBeDefined();
            expect(mockResolver).toHaveBeenCalled();
        });

        it("should reject storeMetaEnvelope without X-ENAME", async () => {
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
            ).rejects.toThrow("X-ENAME header is required");
            
            // CRITICAL: Resolver should NOT be executed
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should allow storeMetaEnvelope with Bearer token (optional)", async () => {
            const token = await createValidToken({ platform: "test-platform" });
            const eName = "test@example.com";
            const context = createMockContext({
                eName,
                request: {
                    headers: new Headers({
                        authorization: `Bearer ${token}`,
                    }),
                } as any,
            });

            const mockResolver = vi.fn(async () => {
                return {
                    metaEnvelope: { id: "new-envelope", ontology: "Test" },
                    envelopes: [],
                };
            });

            const wrappedResolver = guard.middleware(mockResolver);
            const result = await wrappedResolver(null, { input: { ontology: "Test", payload: {}, acl: [] } }, context);
            
            // Should execute successfully - Bearer token is optional but allowed
            expect(result).toBeDefined();
            expect(mockResolver).toHaveBeenCalled();
            expect(context.tokenPayload).toBeDefined();
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

        it("should reject operations with only eName (no Bearer token)", async () => {
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
            
            await expect(
                wrappedResolver(null, {}, context)
            ).rejects.toThrow("Authentication required");
            
            // CRITICAL: Resolver should NOT be executed - eName alone is NOT sufficient
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it("should allow operations with valid Bearer token (eName not required for auth)", async () => {
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
            
            // Should execute successfully - Bearer token is sufficient
            expect(result).toBeDefined();
            expect(mockResolver).toHaveBeenCalled();
            expect(context.tokenPayload).toBeDefined();
        });

        it("should allow operations with valid Bearer token AND eName", async () => {
            const token = await createValidToken({ platform: "test-platform" });
            const eName = "test@example.com";
            const context = createMockContext({
                eName,
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
            
            // Should execute successfully - Bearer token is required, eName can be present too
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
describe("granular _acl policies", () => {
        const PLATFORM = "@platform-granular";
        const OTHER_PLATFORM = "@platform-other";
        const USER = "@user-granular";

        /** Stores a record carrying an explicit policy and returns its id. */
        const storeWithPolicy = async (eName: string, _acl: any) => {
            const result = await dbService.storeMetaEnvelope(
                { ontology: "Test", payload: { field: "value" }, acl: ["*"], _acl },
                ["*"],
                eName,
            );
            return result.metaEnvelope.id;
        };

        const contextFor = async (
            eName: string,
            claims: any,
            currentUser: string | null = null,
        ) => {
            const token = await createValidToken(claims);
            return createMockContext({
                eName,
                currentUser,
                request: {
                    headers: new Headers({ authorization: `Bearer ${token}` }),
                } as any,
            });
        };

        it("closes the platform-token bypass a policy is meant to close", async () => {
            const eName = "@vault-granular-1";
            // The legacy array says "*", but the explicit policy names nobody.
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [],
                denials: { enames: [], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            const context = await contextFor(eName, { platform: PLATFORM });
            const resolver = vi.fn(async () => ({ id }));
            const wrapped = guard.middleware(resolver);

            await expect(wrapped(null, { id }, context)).rejects.toThrow("Access denied");
            expect(resolver).not.toHaveBeenCalled();
        });

        it("allows the action a grant carries and refuses one it does not", async () => {
            const eName = "@vault-granular-2";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [{ ename: PLATFORM, perms: 0x01 }],
                denials: { enames: [], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            const context = await contextFor(eName, { platform: PLATFORM });
            const resolver = vi.fn(async () => ({ id }));

            await expect(
                guard.middleware(resolver, Permission.READ)(null, { id }, context),
            ).resolves.toBeDefined();

            await expect(
                guard.middleware(resolver, Permission.DELETE)(null, { id }, context),
            ).rejects.toThrow("Access denied");
        });

        it("lets a denial override a grant to the same party", async () => {
            const eName = "@vault-granular-3";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [{ ename: PLATFORM, perms: 0x0f }],
                denials: { enames: [PLATFORM], conditions: [] },
                default_perms: 0x0f,
                require: [[]],
            });

            const context = await contextFor(eName, { platform: PLATFORM });
            const resolver = vi.fn(async () => ({ id }));

            await expect(
                guard.middleware(resolver)(null, { id }, context),
            ).rejects.toThrow("Access denied");
        });

        it("admits an unnamed platform through default_perms when a group passes", async () => {
            const eName = "@vault-granular-4";
            // An empty group is an AND over zero conditions, so it always passes.
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [],
                denials: { enames: [], conditions: [] },
                default_perms: 0x01,
                require: [[]],
            });

            const context = await contextFor(eName, { platform: OTHER_PLATFORM });
            const resolver = vi.fn(async () => ({ id }));

            await expect(
                guard.middleware(resolver, Permission.READ)(null, { id }, context),
            ).resolves.toBeDefined();
            await expect(
                guard.middleware(resolver, Permission.UPDATE)(null, { id }, context),
            ).rejects.toThrow("Access denied");
        });

        it("prefers a user grant over the platform grant carrying the request", async () => {
            const eName = "@vault-granular-5";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [
                    { ename: PLATFORM, perms: 0x0f },
                    { ename: USER, perms: 0x01 },
                ],
                denials: { enames: [], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            const context = await contextFor(eName, { platform: PLATFORM }, USER);
            const resolver = vi.fn(async () => ({ id }));

            await expect(
                guard.middleware(resolver, Permission.READ)(null, { id }, context),
            ).resolves.toBeDefined();
            // The broader platform grant must not be unioned into the user's.
            await expect(
                guard.middleware(resolver, Permission.DELETE)(null, { id }, context),
            ).rejects.toThrow("Access denied");
        });

        it("fails closed on a require group whose conditions have no evaluator", async () => {
            const eName = "@vault-granular-6";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [],
                denials: { enames: [], conditions: [] },
                default_perms: 0x0f,
                require: [[{ ontology: "@erep", path: "$.score", op: ">=", value: 60 }]],
            });

            const context = await contextFor(eName, { platform: OTHER_PLATFORM });
            const resolver = vi.fn(async () => ({ id }));

            await expect(
                guard.middleware(resolver)(null, { id }, context),
            ).rejects.toThrow("Access denied");
        });

        it("leaves a record with no policy on its original behaviour", async () => {
            const eName = "@vault-granular-7";
            // No _acl: a valid platform token is still sufficient, as before.
            const result = await dbService.storeMetaEnvelope(
                { ontology: "Test", payload: { field: "value" }, acl: ["*"] },
                ["*"],
                eName,
            );
            const id = result.metaEnvelope.id;

            const context = await contextFor(eName, { platform: OTHER_PLATFORM });
            const resolver = vi.fn(async () => ({ id }));

            await expect(
                guard.middleware(resolver, Permission.DELETE)(null, { id }, context),
            ).resolves.toBeDefined();
        });

        it("returns the policy but never the legacy array", async () => {
            const eName = "@vault-granular-8";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [{ ename: PLATFORM, perms: 0x0f }],
                denials: { enames: [], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            const context = await contextFor(eName, { platform: PLATFORM });
            const stored = await dbService.findMetaEnvelopeById(id, eName);
            expect(stored?._acl).toBeDefined();

            const resolver = vi.fn(async () => stored);
            const returned: any = await guard.middleware(resolver)(null, { id }, context);
            expect(returned).not.toHaveProperty("acl");
            expect(returned._acl.grants).toEqual([
                { ename: PLATFORM, perms: 0x0f },
            ]);
        });

        it("reports a legacy record as the policy it is actually enforced as", async () => {
            const eName = "@vault-granular-9";
            const result = await dbService.storeMetaEnvelope(
                { ontology: "Test", payload: { field: "value" }, acl: ["*"] },
                ["*"],
                eName,
            );
            const id = result.metaEnvelope.id;

            const context = await contextFor(eName, { platform: PLATFORM });
            const stored = await dbService.findMetaEnvelopeById(id, eName);
            const resolver = vi.fn(async () => stored);
            const returned: any = await guard.middleware(resolver)(null, { id }, context);

            // ["*"] is everyone, everything -- expressed as an always-passing group.
            expect(returned).not.toHaveProperty("acl");
            expect(returned._acl.default_perms).toBe(0x0f);
            expect(returned._acl.require).toEqual([[]]);
        });
    });

    describe("delegated identity (X-ON-BEHALF-OF)", () => {
        const PLATFORM = "@platform-delegating";
        const USER = "@user-delegated";

        const storeWithPolicy = async (eName: string, _acl: any) => {
            const result = await dbService.storeMetaEnvelope(
                { ontology: "Test", payload: { field: "value" }, acl: ["*"], _acl },
                ["*"],
                eName,
            );
            return result.metaEnvelope.id;
        };

        const contextFor = async (
            eName: string,
            claims: any,
            extra: Partial<VaultContext> = {},
        ) => {
            const token = await createValidToken(claims);
            return createMockContext({
                eName,
                request: {
                    headers: new Headers({ authorization: `Bearer ${token}` }),
                } as any,
                ...extra,
            });
        };

        it("takes the asserted user as the party, outranking the platform grant", async () => {
            const eName = "@vault-delegated-1";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [
                    { ename: PLATFORM, perms: 0x01 },
                    { ename: USER, perms: 0x0f },
                ],
                denials: { enames: [], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            const context = await contextFor(eName, { platform: PLATFORM }, {
                onBehalfOf: USER,
            });
            const resolver = vi.fn(async () => ({ id }));

            // The user grant is more specific, so it decides -- even though the
            // platform carrying the request holds only READ.
            await expect(
                guard.middleware(resolver, Permission.DELETE)(null, { id }, context),
            ).resolves.toBeDefined();
        });

        it("falls back to the platform when no user is asserted", async () => {
            const eName = "@vault-delegated-2";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [
                    { ename: PLATFORM, perms: 0x01 },
                    { ename: USER, perms: 0x0f },
                ],
                denials: { enames: [], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            const context = await contextFor(eName, { platform: PLATFORM });
            const resolver = vi.fn(async () => ({ id }));

            await expect(
                guard.middleware(resolver, Permission.DELETE)(null, { id }, context),
            ).rejects.toThrow("Access denied");
        });

        it("cannot be used to escape a denial on the carrying platform", async () => {
            const eName = "@vault-delegated-3";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [{ ename: USER, perms: 0x0f }],
                denials: { enames: [PLATFORM], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            const context = await contextFor(eName, { platform: PLATFORM }, {
                onBehalfOf: USER,
            });
            const resolver = vi.fn(async () => ({ id }));

            await expect(
                guard.middleware(resolver)(null, { id }, context),
            ).rejects.toThrow("Access denied");
        });

        it("ignores a currentUser that is a signing-key id rather than a party", async () => {
            const eName = "@vault-delegated-4";
            // A Registry platform token's JWT kid is "entropy-key-1", which the
            // context surfaces as currentUser. It must not authorize anything.
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [{ ename: "entropy-key-1", perms: 0x0f }],
                denials: { enames: [], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            const context = await contextFor(eName, { platform: PLATFORM }, {
                currentUser: "entropy-key-1",
            });
            const resolver = vi.fn(async () => ({ id }));

            await expect(
                guard.middleware(resolver)(null, { id }, context),
            ).rejects.toThrow("Access denied");
        });

        it("ignores an asserted identity that is not an eName", async () => {
            const eName = "@vault-delegated-5";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [{ ename: "not-an-ename", perms: 0x0f }],
                denials: { enames: [], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            const context = await contextFor(eName, { platform: PLATFORM }, {
                onBehalfOf: "not-an-ename",
            });
            const resolver = vi.fn(async () => ({ id }));

            await expect(
                guard.middleware(resolver)(null, { id }, context),
            ).rejects.toThrow("Access denied");
        });
    });
describe("group grants and denials end to end", () => {
        const GROUP = "@group-guarded";
        const PLATFORM = "@platform-grouped";
        const MEMBER = "@user-in-group";
        const OUTSIDER = "@user-outside-group";
        const GROUP_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440003";
        const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

        let grouped: VaultAccessGuard;

        beforeAll(() => {
            grouped = new VaultAccessGuard(
                dbService,
                undefined,
                new GroupMembershipService(dbService),
            );
        });

        const storeWithPolicy = async (eName: string, _acl: any) => {
            const result = await dbService.storeMetaEnvelope(
                { ontology: "Test", payload: { field: "value" }, acl: ["*"], _acl },
                ["*"],
                eName,
            );
            return result.metaEnvelope.id;
        };

        const contextFor = async (eName: string, onBehalfOf: string) => {
            const token = await createValidToken({ platform: PLATFORM });
            return createMockContext({
                eName,
                onBehalfOf,
                request: {
                    headers: new Headers({ authorization: `Bearer ${token}` }),
                } as any,
            });
        };

        it("admits a member through a group grant, by eName and by profile id", async () => {
            // One member is listed by eName, the other by their profile record's
            // id -- both forms occur in real group records.
            const profile = await dbService.storeMetaEnvelope(
                { ontology: USER_ONTOLOGY, payload: { ename: OUTSIDER }, acl: ["*"] },
                ["*"],
                "@profile-vault",
            );
            await dbService.storeMetaEnvelope(
                {
                    ontology: GROUP_ONTOLOGY,
                    payload: {
                        ename: GROUP,
                        name: "Guarded",
                        members: [MEMBER],
                        participantIds: [profile.metaEnvelope.id],
                    },
                    acl: ["*"],
                },
                ["*"],
                GROUP,
            );

            const eName = "@vault-group-1";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [{ ename: GROUP, perms: 0x01 }],
                denials: { enames: [], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            for (const member of [MEMBER, OUTSIDER]) {
                const context = await contextFor(eName, member);
                await expect(
                    grouped.middleware(vi.fn(async () => ({ id })), Permission.READ)(
                        null,
                        { id },
                        context,
                    ),
                ).resolves.toBeDefined();
            }
        });

        it("refuses someone who is not in the granted group", async () => {
            const eName = "@vault-group-2";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [{ ename: GROUP, perms: 0x0f }],
                denials: { enames: [], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            const context = await contextFor(eName, "@nobody-in-particular");
            await expect(
                grouped.middleware(vi.fn(async () => ({ id })))(null, { id }, context),
            ).rejects.toThrow("Access denied");
        });

        it("denies a member of a denied group despite a direct grant", async () => {
            const eName = "@vault-group-3";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [{ ename: MEMBER, perms: 0x0f }],
                denials: { enames: [GROUP], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            const context = await contextFor(eName, MEMBER);
            await expect(
                grouped.middleware(vi.fn(async () => ({ id })))(null, { id }, context),
            ).rejects.toThrow("Access denied");
        });

        it("leaves a group denial inert when no resolver is configured", async () => {
            // The guard without a resolver cannot resolve groups at all, which
            // is the feature switched off rather than a failed lookup.
            const eName = "@vault-group-4";
            const id = await storeWithPolicy(eName, {
                v: 1,
                grants: [{ ename: MEMBER, perms: 0x0f }],
                denials: { enames: [GROUP], conditions: [] },
                default_perms: 0x00,
                require: [],
            });

            const context = await contextFor(eName, MEMBER);
            await expect(
                guard.middleware(vi.fn(async () => ({ id })))(null, { id }, context),
            ).resolves.toBeDefined();
        });
    });
});
