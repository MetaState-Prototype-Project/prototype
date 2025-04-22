import { describe, it, expect } from "vitest";
import {
  signJWT,
  createJWT,
  getJWTHeader,
  getJWTPayload,
  verifyJWT,
} from "../../src/utils/jwt";
import type { JWTPayload, JWTHeader, Signer } from "../../src/logs/log.types";

describe("JWT Utils", () => {
  const mockSigner: Signer = {
    sign: (message: string) => Buffer.from(message).toString("base64url"),
    pubKey: "mock-public-key",
    alg: "ES256",
  };

  const mockPayload = {
    sub: "test-subject",
    iat: Math.floor(Date.now() / 1000),
  };

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
    it("should create a valid JWT with the correct structure", async () => {
      const kid = "test-kid";
      const jwt = await signJWT(mockSigner, mockPayload, kid);

      expect(jwt).toBeDefined();
      expect(jwt.split(".")).toHaveLength(3);

      const [header, payload, signature] = jwt.split(".");
      expect(header).toBeDefined();
      expect(payload).toBeDefined();
      expect(signature).toBeDefined();
    });

    it("should include kid in the header when provided", async () => {
      const kid = "test-kid";
      const jwt = await signJWT(mockSigner, mockPayload, kid);
      const header = getJWTHeader(jwt);

      expect(header.kid).toBe(kid);
      expect(header.alg).toBe(mockSigner.alg);
    });

    it("should use custom header if provided", async () => {
      const customHeader: JWTHeader = {
        alg: "RS256",
        typ: "JWT",
        kid: "custom-key",
      };

      const signedJWT = await signJWT(
        mockSigner,
        mockPayload,
        "test-key-1",
        customHeader
      );
      const header = getJWTHeader(signedJWT);

      expect(header).toEqual(customHeader);
    });
  });

  describe("getJWTHeader", () => {
    it("should correctly extract and parse the header", async () => {
      const kid = "test-kid";
      const jwt = await signJWT(mockSigner, mockPayload, kid);
      const header = getJWTHeader(jwt);

      expect(header).toEqual({
        alg: mockSigner.alg,
        typ: "JWT",
        kid,
      });
    });
  });

  describe("getJWTPayload", () => {
    it("should correctly extract and parse the payload", async () => {
      const jwt = await signJWT(mockSigner, mockPayload, "test-kid");
      const payload = getJWTPayload(jwt);

      expect(payload).toEqual(mockPayload);
    });
  });

  describe("verifyJWT", () => {
    it("should verify a valid JWT", async () => {
      const jwt = await signJWT(mockSigner, mockPayload, "test-kid");
      const [headerPayload, signature] = jwt.split(".");

      const mockVerifier = async (
        message: string,
        sig: string,
        pubKey: string
      ) => {
        expect(message).toBe(headerPayload);
        expect(sig).toBe(signature);
        expect(pubKey).toBe(mockSigner.pubKey);
        return true;
      };

      const isValid = await verifyJWT(
        headerPayload,
        signature,
        mockVerifier,
        mockSigner.pubKey
      );
      expect(isValid).toBe(true);
    });

    it("should reject a JWT with invalid signature", async () => {
      const jwt = await signJWT(mockSigner, mockPayload, "test-kid");
      const [headerPayload, signature] = jwt.split(".");
      const invalidSignature = signature.slice(0, -1) + "x"; // Tamper with the signature

      const mockVerifier = async (
        message: string,
        sig: string,
        pubKey: string
      ) => {
        expect(message).toBe(headerPayload);
        expect(sig).toBe(invalidSignature);
        expect(pubKey).toBe(mockSigner.pubKey);
        return false;
      };

      const isValid = await verifyJWT(
        headerPayload,
        invalidSignature,
        mockVerifier,
        mockSigner.pubKey
      );
      expect(isValid).toBe(false);
    });
  });
});
