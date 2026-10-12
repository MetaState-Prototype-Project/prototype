import axios from "axios";
import { SignJWT, generateKeyPair } from "jose";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import {
    getSharedTestKeyPair,
    getSharedTestPublicJWK,
} from "../../test-utils/shared-test-keys";
import {
    cachedPlatformVerdicts,
    resetRegistryTokenCaches,
    verifyPlatform,
    verifyRegistryToken,
} from "./registry-token";

vi.mock("axios");
const mockedAxios = axios as any;

describe("registry-token", () => {
    const previousRegistryUrl = process.env.PUBLIC_REGISTRY_URL;
    let privateKey: any;

    async function sign(
        payload: Record<string, unknown>,
        options: { key?: any; expiresIn?: string | number } = {},
    ) {
        return new SignJWT(payload)
            .setProtectedHeader({ alg: "ES256", kid: "entropy-key-1" })
            .setIssuedAt()
            .setExpirationTime(options.expiresIn ?? "1h")
            .sign(options.key ?? privateKey);
    }

    beforeAll(async () => {
        privateKey = (await getSharedTestKeyPair()).privateKey;
        process.env.PUBLIC_REGISTRY_URL = "http://registry.test";
    });

    afterAll(() => {
        if (previousRegistryUrl === undefined) {
            delete process.env.PUBLIC_REGISTRY_URL;
        } else {
            process.env.PUBLIC_REGISTRY_URL = previousRegistryUrl;
        }
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        resetRegistryTokenCaches();
        mockedAxios.get.mockResolvedValue({
            data: { keys: [await getSharedTestPublicJWK()] },
        });
    });

    it("returns the payload of a Registry-signed token", async () => {
        const token = await sign({ platform: "http://pictique.test" });
        const payload = await verifyRegistryToken(token);
        expect(payload.platform).toBe("http://pictique.test");
        expect(mockedAxios.get).toHaveBeenCalledWith(
            "http://registry.test/.well-known/jwks.json",
            expect.anything(),
        );
    });

    it("fetches the key set once for many tokens", async () => {
        await verifyRegistryToken(await sign({ platform: "a" }));
        await verifyRegistryToken(await sign({ platform: "b" }));
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it("proves the platform of a valid token", async () => {
        const token = await sign({ platform: " http://pictique.test " });
        expect(await verifyPlatform(token)).toBe("http://pictique.test");
    });

    it("gives no platform for a token signed by another key", async () => {
        const other = await generateKeyPair("ES256");
        const token = await sign(
            { platform: "http://pictique.test" },
            { key: other.privateKey },
        );
        expect(await verifyPlatform(token)).toBeNull();
    });

    it("gives no platform for an expired token", async () => {
        const token = await sign(
            { platform: "http://pictique.test" },
            { expiresIn: Math.floor(Date.now() / 1000) - 60 },
        );
        expect(await verifyPlatform(token)).toBeNull();
    });

    it("gives no platform when the claim is absent or unusable", async () => {
        expect(await verifyPlatform(await sign({}))).toBeNull();
        expect(await verifyPlatform(await sign({ platform: 7 }))).toBeNull();
        expect(
            await verifyPlatform(await sign({ platform: "x".repeat(257) })),
        ).toBeNull();
        expect(await verifyPlatform("garbage")).toBeNull();
        expect(await verifyPlatform(null)).toBeNull();
    });

    it("asks an unreachable Registry once, then backs off", async () => {
        mockedAxios.get.mockRejectedValue(new Error("registry down"));
        const first = await sign({ platform: "a" });
        const second = await sign({ platform: "b" });
        expect(await verifyPlatform(first)).toBeNull();
        expect(await verifyPlatform(second)).toBeNull();
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it("does not pin a good token to no platform during an outage", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        try {
            const token = await sign({ platform: "http://pictique.test" });
            mockedAxios.get.mockRejectedValueOnce(new Error("registry down"));
            expect(await verifyPlatform(token)).toBeNull();
            vi.advanceTimersByTime(31_000);
            expect(await verifyPlatform(token)).toBe("http://pictique.test");
        } finally {
            vi.useRealTimers();
        }
    });

    it("keeps the verdict cache bounded", async () => {
        for (let i = 0; i < 5010; i++) await verifyPlatform(`junk-${i}`);
        expect(cachedPlatformVerdicts()).toBe(5000);
    });
});
