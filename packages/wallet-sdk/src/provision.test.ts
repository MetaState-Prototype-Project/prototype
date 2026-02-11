import { describe, expect, it, vi } from "vitest";
import type { CryptoAdapter } from "./crypto-adapter.js";
import { provision } from "./provision.js";

function createFakeAdapter(overrides?: {
    getPublicKey?: string;
}): CryptoAdapter {
    return {
        async getPublicKey() {
            return overrides?.getPublicKey ?? "zFakePublicKey";
        },
        async signPayload() {
            return "fakeSignature";
        },
        async ensureKey() {
            return { created: false };
        },
    };
}

describe("provision", () => {
    it("calls fetch for entropy and provision with adapter public key", async () => {
        const fetchMock = vi.fn();
        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ token: "entropy-token" }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        success: true,
                        w3id: "w3id:test",
                        uri: "https://evault.example/vault",
                    }),
            });
        vi.stubGlobal("fetch", fetchMock);

        const adapter = createFakeAdapter({ getPublicKey: "zMyKey" });
        const result = await provision(adapter, {
            registryUrl: "https://registry.example",
            provisionerUrl: "https://provisioner.example",
            namespace: "ns-123",
            verificationId: "v-456",
        });

        expect(result).toEqual({
            success: true,
            w3id: "w3id:test",
            uri: "https://evault.example/vault",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            "https://registry.example/entropy",
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "https://provisioner.example/provision",
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    registryEntropy: "entropy-token",
                    namespace: "ns-123",
                    verificationId: "v-456",
                    publicKey: "zMyKey",
                }),
            }),
        );

        vi.unstubAllGlobals();
    });

    it("throws when adapter returns no public key", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ token: "entropy-token" }),
        }));

        const adapter = createFakeAdapter();
        vi.spyOn(adapter, "getPublicKey").mockResolvedValue(undefined);

        await expect(
            provision(adapter, {
                registryUrl: "https://registry.example",
                provisionerUrl: "https://provisioner.example",
                namespace: "ns",
                verificationId: "v",
            }),
        ).rejects.toThrow("No public key");

        vi.unstubAllGlobals();
    });
});
