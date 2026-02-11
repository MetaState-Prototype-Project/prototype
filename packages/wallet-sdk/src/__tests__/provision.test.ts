import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { provision } from "../provision.js";
import { TestCryptoAdapter } from "./TestCryptoAdapter.js";

describe("provision", () => {
    const adapter = new TestCryptoAdapter();
    const registryUrl = "https://registry.test";
    const provisionerUrl = "https://provisioner.test";

    beforeEach(async () => {
        await adapter.ensureKey("default", "onboarding");
        vi.stubGlobal(
            "fetch",
            vi.fn((input: string | URL, init?: RequestInit) => {
                const url = typeof input === "string" ? input : input.toString();
                if (url === `${registryUrl}/entropy`) {
                    return Promise.resolve(
                        new Response(JSON.stringify({ token: "mock-jwt-entropy" }), {
                            status: 200,
                        }),
                    );
                }
                if (url === `${provisionerUrl}/provision`) {
                    const body = init?.body ? JSON.parse(init.body as string) : {};
                    if (!body.registryEntropy || !body.namespace || !body.verificationId) {
                        return Promise.resolve(
                            new Response(
                                JSON.stringify({
                                    success: false,
                                    message: "Missing required fields",
                                }),
                                { status: 500 },
                            ),
                        );
                    }
                    return Promise.resolve(
                        new Response(
                            JSON.stringify({
                                success: true,
                                w3id: "w3id-123",
                                uri: "https://evault.test/instance-1",
                            }),
                            { status: 200 },
                        ),
                    );
                }
                return Promise.reject(new Error(`Unexpected fetch: ${url}`));
            }),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns w3id and uri on success", async () => {
        const result = await provision(adapter, {
            registryUrl,
            provisionerUrl,
            namespace: "ns-1",
            verificationId: "v-1",
        });
        expect(result.w3id).toBe("w3id-123");
        expect(result.uri).toBe("https://evault.test/instance-1");
        expect(result.success).toBe(true);
    });

    it("uses optional namespace and verificationId", async () => {
        const result = await provision(adapter, {
            registryUrl,
            provisionerUrl,
            namespace: "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee",
            verificationId: "custom-verification-id",
        });
        expect(result.w3id).toBe("w3id-123");
        const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
            .calls as Array<[string, RequestInit]>;
        const provisionCall = fetchCall.find(
            ([url]) => url === `${provisionerUrl}/provision`,
        );
        expect(provisionCall).toBeDefined();
        const body = JSON.parse((provisionCall![1].body as string) ?? "{}");
        expect(body.namespace).toBe("aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee");
        expect(body.verificationId).toBe("custom-verification-id");
        expect(body.publicKey).toBe("test-public-key-base64-or-multibase");
    });

    it("throws when registry entropy fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn((input: string | URL) => {
                const url = typeof input === "string" ? input : input.toString();
                if (url === `${registryUrl}/entropy`) {
                    return Promise.resolve(new Response("error", { status: 500 }));
                }
                return Promise.reject(new Error(`Unexpected: ${url}`));
            }),
        );
        await expect(
            provision(adapter, {
                registryUrl,
                provisionerUrl,
                namespace: "ns",
                verificationId: "v",
            }),
        ).rejects.toThrow(/Failed to get entropy/);
    });

    it("throws when provisioner returns failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn((input: string | URL, init?: RequestInit) => {
                const url = typeof input === "string" ? input : input.toString();
                if (url === `${registryUrl}/entropy`) {
                    return Promise.resolve(
                        new Response(JSON.stringify({ token: "jwt" }), { status: 200 }),
                    );
                }
                if (url === `${provisionerUrl}/provision`) {
                    return Promise.resolve(
                        new Response(
                            JSON.stringify({
                                success: false,
                                message: "verification doesn't exist",
                            }),
                            { status: 200 },
                        ),
                    );
                }
                return Promise.reject(new Error(`Unexpected: ${url}`));
            }),
        );
        await expect(
            provision(adapter, {
                registryUrl,
                provisionerUrl,
                namespace: "ns",
                verificationId: "v",
            }),
        ).rejects.toThrow(/Invalid provision response/);
    });
});
