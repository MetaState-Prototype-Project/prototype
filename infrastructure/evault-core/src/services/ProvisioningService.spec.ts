import "reflect-metadata";
import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
    vi,
} from "vitest";
import {
    ProvisioningService,
    ProvisionRequest,
} from "./ProvisioningService";
import { VerificationService } from "./VerificationService";
import { Verification } from "../entities/Verification";
import {
    setupTestDatabase,
    teardownTestDatabase,
} from "../test-utils/postgres-setup";
import { DataSource } from "typeorm";
import { Repository } from "typeorm";
import axios from "axios";
import {
    createMockRegistryServer,
    stopMockRegistryServer,
} from "../test-utils/mock-registry-server";
import { FastifyInstance } from "fastify";
import { AddressInfo } from "node:net";
// Mock generateEntropy for testing - we'll create tokens manually
// import { generateEntropy } from "../../../platforms/registry/src/jwt";

// Mock axios
vi.mock("axios", () => {
    const mockAxios = {
        get: vi.fn(),
        post: vi.fn(),
        create: vi.fn(),
    } as any;
    mockAxios.create.mockReturnValue(mockAxios);
    return {
        default: mockAxios,
        ...mockAxios,
    };
});
const mockedAxios = axios as any;

// Mock jose at module level
vi.mock("jose", async () => {
    const actual = await vi.importActual("jose");
    return {
        ...actual,
        jwtVerify: vi
            .fn()
            .mockImplementation(async (token: string, jwks: any) => {
                // For mock tokens, return mock payload with entropy
                // Entropy should be a random string that W3ID can use to generate UUID v5
                if (
                    token === "mock.jwt.token.here" ||
                    token.includes("mock") ||
                    (typeof token === "string" && token !== "invalid-token")
                ) {
                    // Use a random hex string that will work with W3ID's UUID v5 generation
                    // W3ID uses UUID v5 which requires a namespace and a name (entropy)
                    return {
                        payload: { entropy: "test-entropy-1234567890abcdef" }, // Random string for UUID v5
                    };
                }
                // For invalid tokens, throw
                if (token === "invalid-token") {
                    throw new Error("Invalid token");
                }
                // Otherwise use actual verification (will likely fail)
                return (actual as any).jwtVerify(token, jwks);
            }),
    };
});

describe("ProvisioningService", () => {
    let dataSource: DataSource;
    let verificationService: VerificationService;
    let provisioningService: ProvisioningService;
    let verificationRepository: Repository<Verification>;
    let mockRegistryServer: FastifyInstance;
    let registryUrl: string;

    beforeAll(async () => {
        const setup = await setupTestDatabase();
        dataSource = setup.dataSource;
        verificationRepository = dataSource.getRepository(Verification);
        verificationService = new VerificationService(verificationRepository);

        // Start mock registry server
        mockRegistryServer = await createMockRegistryServer(0);
        const address = mockRegistryServer.server.address() as AddressInfo;
        registryUrl = `http://localhost:${address.port}`;
        process.env.PUBLIC_REGISTRY_URL = registryUrl;
        process.env.REGISTRY_SHARED_SECRET = "test-secret";
        process.env.PUBLIC_EVAULT_SERVER_URI = "http://localhost:3000";
        process.env.DIDIT_API_KEY = "test-didit-api-key";

        provisioningService = new ProvisioningService(verificationService);
    });

    afterAll(async () => {
        await stopMockRegistryServer(mockRegistryServer);
        await teardownTestDatabase();
        delete process.env.PUBLIC_REGISTRY_URL;
        delete process.env.REGISTRY_SHARED_SECRET;
        delete process.env.PUBLIC_EVAULT_SERVER_URI;
        delete process.env.DIDIT_API_KEY;
    });

    beforeEach(async () => {
        await verificationRepository.clear();
        vi.clearAllMocks();

        // Mock JWKS endpoint - always return valid JWKS for mock tokens
        mockedAxios.get.mockImplementation(async (url: string) => {
            if (url.includes("/.well-known/jwks.json")) {
                return {
                    data: {
                        keys: [
                            {
                                kty: "EC",
                                crv: "P-256",
                                x: "test-x",
                                y: "test-y",
                                kid: "entropy-key-1",
                                alg: "ES256",
                            },
                        ],
                    },
                };
            }
            throw new Error(`Unexpected URL: ${url}`);
        });

        // Note: jose mocking needs to be at module level, so we'll handle JWT errors in tests
    });

    const createValidRequest = async (): Promise<ProvisionRequest> => {
        // Create a mock registry entropy token (JWT format)
        // In real scenarios, this would be generated by the registry
        // For testing, we'll create a simple token-like string
        // The actual validation will be mocked via JWKS
        const token = "mock.jwt.token.here";
        return {
            registryEntropy: token,
            namespace: "52258594-1cd2-45f0-90cc-d34a047edf4b",
            verificationId: process.env.DEMO_CODE_W3DS || "d66b7138-538a-465f-a6ce-f6985854c3f4",
            publicKey: "test-public-key",
        };
    };

    describe("provisionEVault - success path", () => {
        it("should successfully provision eVault with valid demo code", async () => {
            const request = await createValidRequest();

            // Mock registry registration
            mockedAxios.post.mockResolvedValueOnce({
                status: 201,
                data: { success: true },
            });

            const result = await provisioningService.provisionEVault(request);

            expect(result.success).toBe(true);
            expect(result.w3id).toBeDefined();
            expect(result.uri).toBeDefined();
            expect(mockedAxios.post).toHaveBeenCalledWith(
                expect.stringContaining("/register"),
                expect.objectContaining({
                    ename: result.w3id,
                    uri: result.uri,
                }),
                expect.any(Object)
            );
        });

        it("should successfully provision eVault with valid verification", async () => {
            // Create approved verification
            const verification = await verificationService.create({
                linkedEName: undefined,
                approved: true,
                consumed: false,
                diditSessionId: "11111111-1111-4111-8111-111111111111",
            });

            const request = await createValidRequest();
            request.verificationId = verification.id;

            // Mock registry registration
            mockedAxios.post.mockResolvedValueOnce({
                status: 201,
                data: { success: true },
            });
            mockedAxios.get.mockImplementation(async (url: string) => {
                if (url.includes("/.well-known/jwks.json")) {
                    return {
                        data: {
                            keys: [
                                {
                                    kty: "EC",
                                    crv: "P-256",
                                    x: "test-x",
                                    y: "test-y",
                                    kid: "entropy-key-1",
                                    alg: "ES256",
                                },
                            ],
                        },
                    };
                }
                if (url.includes("/decision/")) {
                    return {
                        data: {
                            status: "Approved",
                            id_verifications: [],
                        },
                    };
                }
                throw new Error(`Unexpected URL: ${url}`);
            });

            const result = await provisioningService.provisionEVault(request);

            expect(result.success).toBe(true);
            expect(result.w3id).toBeDefined();

            // Verify verification was updated and consumed
            const updated = await verificationService.findById(verification.id);
            expect(updated?.linkedEName).toBe(result.w3id);
            expect(updated?.consumed).toBe(true);
        });

        it("should generate deterministic eName for same input variables", async () => {
            const request1 = await createValidRequest();
            const request2 = await createValidRequest();
            
            // Ensure both requests have identical inputs
            request2.registryEntropy = request1.registryEntropy;
            request2.namespace = request1.namespace;
            request2.verificationId = request1.verificationId;
            request2.publicKey = request1.publicKey;

            // Mock registry registration for both calls
            mockedAxios.post.mockResolvedValue({
                status: 201,
                data: { success: true },
            });

            const result1 = await provisioningService.provisionEVault(request1);
            const result2 = await provisioningService.provisionEVault(request2);

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            expect(result1.w3id).toBeDefined();
            expect(result2.w3id).toBeDefined();
            // Same inputs should produce the same eName
            expect(result1.w3id).toBe(result2.w3id);
        });
    });

    describe("provisionEVault - error cases", () => {
        it("should fail with missing required fields", async () => {
            const request: Partial<ProvisionRequest> = {
                registryEntropy: "token",
                // Missing other fields
            };

            const result = await provisioningService.provisionEVault(
                request as ProvisionRequest
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should fail with invalid registry entropy", async () => {
            const request = await createValidRequest();
            request.registryEntropy = "invalid-token";

            // Mock JWKS endpoint
            mockedAxios.get.mockResolvedValueOnce({
                data: {
                    keys: [
                        {
                            kty: "EC",
                            crv: "P-256",
                            x: "test-x",
                            y: "test-y",
                            kid: "entropy-key-1",
                            alg: "ES256",
                        },
                    ],
                },
            });

            // JWT verification will fail with invalid token
            const result = await provisioningService.provisionEVault(request);

            expect(result.success).toBe(false);
            expect(result.message).toContain("Failed to provision");
        });

        it("should fail when verification does not exist", async () => {
            const request = await createValidRequest();
            request.verificationId = "non-existent-id";

            const result = await provisioningService.provisionEVault(request);

            expect(result.success).toBe(false);
            expect(result.message).toContain("verification doesn't exist");
        });

        it("should fail when verification is not approved", async () => {
            const verification = await verificationService.create({
                linkedEName: undefined,
                approved: false,
                consumed: false,
            });

            const request = await createValidRequest();
            request.verificationId = verification.id;

            const result = await provisioningService.provisionEVault(request);

            expect(result.success).toBe(false);
            expect(result.message).toContain("verification not approved");
        });

        it("should fail when verification is already consumed", async () => {
            const verification = await verificationService.create({
                linkedEName: "existing@example.com",
                approved: true,
                consumed: true,
            });

            const request = await createValidRequest();
            request.verificationId = verification.id;

            const result = await provisioningService.provisionEVault(request);

            expect(result.success).toBe(false);
            expect(result.message).toContain("already been used");
        });

        it("should fail when registry registration fails", async () => {
            const request = await createValidRequest();

            mockedAxios.post.mockRejectedValueOnce({
                response: {
                    status: 500,
                    data: { error: "Internal server error" },
                },
            });

            const result = await provisioningService.provisionEVault(request);

            expect(result.success).toBe(false);
            expect(result.message).toContain("Failed to provision");
        });
    });
});
