import { generateEntropy, generatePlatformToken, getJWK } from "./jwt";
import { jwtVerify, createLocalJWKSet } from "jose";
import { generateKeyPair, exportJWK } from "jose";

describe("JWT Functions", () => {
    let testPrivateKey: any;
    let testPublicKey: any;
    let testJWK: any;

    beforeAll(async () => {
        // Generate test keys for testing
        const { publicKey, privateKey } = await generateKeyPair("ES256", {
            extractable: true,
        });

        testPrivateKey = privateKey;
        testPublicKey = publicKey;
        testJWK = await exportJWK(privateKey);
        testJWK.kid = "entropy-key-1";
        testJWK.alg = "ES256";
        testJWK.use = "sig";

        // Set environment variable for JWT functions
        process.env.REGISTRY_ENTROPY_KEY_JWK = JSON.stringify(testJWK);
    });

    afterAll(() => {
        delete process.env.REGISTRY_ENTROPY_KEY_JWK;
    });

    describe("generateEntropy", () => {
        it("should generate valid JWT with entropy", async () => {
            const token = await generateEntropy();

            expect(token).toBeDefined();
            expect(typeof token).toBe("string");

            // Verify the token can be decoded and verified
            const jwks = await getJWK();
            const JWKS = createLocalJWKSet(jwks);
            const { payload } = await jwtVerify(token, JWKS);

            expect(payload.entropy).toBeDefined();
            expect(typeof payload.entropy).toBe("string");
            expect((payload.entropy as string).length).toBe(20);
            expect(payload.exp).toBeDefined();
            expect(payload.iat).toBeDefined();
        });

        it("should generate different entropy on each call", async () => {
            const token1 = await generateEntropy();
            const token2 = await generateEntropy();

            expect(token1).not.toBe(token2);

            const jwks = await getJWK();
            const JWKS = createLocalJWKSet(jwks);
            const { payload: payload1 } = await jwtVerify(token1, JWKS);
            const { payload: payload2 } = await jwtVerify(token2, JWKS);

            expect(payload1.entropy).not.toBe(payload2.entropy);
        });
    });

    describe("generatePlatformToken", () => {
        it("should generate platform token with correct claims", async () => {
            const platform = "test-platform";
            const token = await generatePlatformToken(platform);

            expect(token).toBeDefined();
            expect(typeof token).toBe("string");

            // Verify the token
            const jwks = await getJWK();
            const JWKS = createLocalJWKSet(jwks);
            const { payload } = await jwtVerify(token, JWKS);

            expect(payload.platform).toBe(platform);
            expect(payload.exp).toBeDefined();
            expect(payload.iat).toBeDefined();
        });

        it("should generate different tokens for different platforms", async () => {
            const token1 = await generatePlatformToken("platform1");
            const token2 = await generatePlatformToken("platform2");

            expect(token1).not.toBe(token2);

            const jwks = await getJWK();
            const JWKS = createLocalJWKSet(jwks);
            const { payload: payload1 } = await jwtVerify(token1, JWKS);
            const { payload: payload2 } = await jwtVerify(token2, JWKS);

            expect(payload1.platform).toBe("platform1");
            expect(payload2.platform).toBe("platform2");
        });
    });

    describe("getJWK", () => {
        it("should return valid JWK for verification", async () => {
            const jwk = await getJWK();

            expect(jwk).toBeDefined();
            expect(jwk.keys).toBeDefined();
            expect(Array.isArray(jwk.keys)).toBe(true);
            expect(jwk.keys.length).toBeGreaterThan(0);

            const key = jwk.keys[0];
            expect(key.kid).toBeDefined();
            expect(key.alg).toBeDefined();
            expect(key.d).toBeUndefined(); // Private key should not be exposed
        });

        it("should return JWK that can verify generated tokens", async () => {
            const token = await generateEntropy();
            const jwks = await getJWK();
            const JWKS = createLocalJWKSet(jwks);

            const { payload } = await jwtVerify(token, JWKS);

            expect(payload.entropy).toBeDefined();
        });
    });
});

