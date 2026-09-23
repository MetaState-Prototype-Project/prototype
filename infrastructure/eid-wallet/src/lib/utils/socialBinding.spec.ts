import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearVaultUriCache, resolveVaultUri } from "./socialBinding";

const ENAME = "@ada-0000-0000";
const OTHER = "@grace-1111-1111";
const VAULT_URI = "http://vault.test:4000";
const EXPECTED = "http://vault.test:4000/graphql";

/** Registry responds with a vault URI; counts how often it was actually hit. */
function stubRegistry(uri = VAULT_URI) {
    const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ uri }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

beforeEach(() => {
    clearVaultUriCache();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("resolveVaultUri — registry lookup memoisation", () => {
    it("hits the registry once for repeated sequential lookups", async () => {
        const fetchMock = stubRegistry();

        expect(await resolveVaultUri(ENAME)).toBe(EXPECTED);
        expect(await resolveVaultUri(ENAME)).toBe(EXPECTED);
        expect(await resolveVaultUri(ENAME)).toBe(EXPECTED);

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("coalesces concurrent lookups of the same eName into one request", async () => {
        const fetchMock = stubRegistry();

        // This is the real shape of the bug: the binding reconcile and the name
        // lookup resolve the same counterparty at the same time, via Promise.all.
        const results = await Promise.all([
            resolveVaultUri(ENAME),
            resolveVaultUri(ENAME),
            resolveVaultUri(ENAME),
            resolveVaultUri(ENAME),
        ]);

        expect(results).toEqual([EXPECTED, EXPECTED, EXPECTED, EXPECTED]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("treats a bare eName and an @-prefixed one as the same cache entry", async () => {
        const fetchMock = stubRegistry();

        await resolveVaultUri("ada-0000-0000");
        await resolveVaultUri("@ada-0000-0000");

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("keeps distinct eNames independent", async () => {
        const fetchMock = stubRegistry();

        await resolveVaultUri(ENAME);
        await resolveVaultUri(OTHER);

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not cache failures — a later lookup retries the registry", async () => {
        const failing = vi.fn(async () => ({ ok: false, status: 503 }));
        vi.stubGlobal("fetch", failing);

        await expect(resolveVaultUri(ENAME)).rejects.toThrow(
            /could not resolve/i,
        );
        await expect(resolveVaultUri(ENAME)).rejects.toThrow(
            /could not resolve/i,
        );

        expect(failing).toHaveBeenCalledTimes(2);
    });

    it("clearVaultUriCache forces the next lookup back to the registry", async () => {
        const fetchMock = stubRegistry();

        await resolveVaultUri(ENAME);
        clearVaultUriCache();
        await resolveVaultUri(ENAME);

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
