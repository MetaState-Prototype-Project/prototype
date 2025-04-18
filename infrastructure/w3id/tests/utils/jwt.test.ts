import { describe, it, expect } from "vitest";
import {
    signJWT,
    createJWT,
    getJWTHeader,
    getJWTPayload,
} from "../../src/utils/jwt";
import type { JWTPayload, JWTHeader } from "../../src/logs/log.types";

describe("JWT Utils", () => {
    describe("createJWT", () => {
        it("should create a valid JWT string", () => {
            const header: JWTHeader = {
                alg: "ES256",
                typ: "JWT",
                kid: "test-key-1",
            };
            const payload: JWTPayload = {
                sub: "user123",
                iat: 1234567890,
                exp: 1234567890 + 3600,
            };

            const jwt = createJWT(header, payload);
            const [headerPart, payloadPart] = jwt.split(".");

            expect(headerPart).toBeDefined();
            expect(payloadPart).toBeDefined();
            expect(jwt).not.toContain("="); // No padding
            expect(jwt).not.toContain("+"); // No plus signs
            expect(jwt).not.toContain("/"); // No slashes
        });
    });

    describe("signJWT", () => {
        it("should sign a JWT with the provided signer", async () => {
            const mockSigner = {
                sign: async (message: string) => "mock-signature",
                pubKey: "mock-pubkey",
                alg: "ES256",
            };

            const payload: JWTPayload = {
                sub: "user123",
                iat: 1234567890,
            };

            const signedJWT = await signJWT(mockSigner, payload, "test-key-1");
            const [headerPart, payloadPart, signature] = signedJWT.split(".");

            expect(headerPart).toBeDefined();
            expect(payloadPart).toBeDefined();
            expect(signature).toBe("mock-signature");
        });

        it("should use the provided kid in the header", async () => {
            const mockSigner = {
                sign: async (message: string) => "mock-signature",
                pubKey: "mock-pubkey",
                alg: "ES256",
            };

            const payload: JWTPayload = {
                sub: "user123",
            };

            const signedJWT = await signJWT(mockSigner, payload, "test-key-1");
            const header = getJWTHeader(signedJWT);

            expect(header.kid).toBe("test-key-1");
            expect(header.alg).toBe("ES256");
            expect(header.typ).toBe("JWT");
        });

        it("should use custom header if provided", async () => {
            const mockSigner = {
                sign: async (message: string) => "mock-signature",
                pubKey: "mock-pubkey",
                alg: "ES256",
            };

            const payload: JWTPayload = {
                sub: "user123",
            };

            const customHeader: JWTHeader = {
                alg: "RS256",
                typ: "JWT",
                kid: "custom-key",
            };

            const signedJWT = await signJWT(
                mockSigner,
                payload,
                "test-key-1",
                customHeader,
            );
            const header = getJWTHeader(signedJWT);

            expect(header).toEqual(customHeader);
        });
    });

    describe("getJWTHeader", () => {
        it("should extract the header from a JWT", () => {
            const header: JWTHeader = {
                alg: "ES256",
                typ: "JWT",
                kid: "test-key-1",
            };
            const payload: JWTPayload = {
                sub: "user123",
            };

            const jwt = createJWT(header, payload);
            const extractedHeader = getJWTHeader(jwt);

            expect(extractedHeader).toEqual(header);
        });
    });

    describe("getJWTPayload", () => {
        it("should extract the payload from a JWT", () => {
            const header: JWTHeader = {
                alg: "ES256",
                typ: "JWT",
                kid: "test-key-1",
            };
            const payload: JWTPayload = {
                sub: "user123",
                iat: 1234567890,
                exp: 1234567890 + 3600,
            };

            const jwt = createJWT(header, payload);
            const extractedPayload = getJWTPayload(jwt);

            expect(extractedPayload).toEqual(payload);
        });
    });
});
