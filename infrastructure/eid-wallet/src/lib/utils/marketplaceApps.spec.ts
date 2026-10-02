import { describe, expect, it, vi } from "vitest";
import {
    fetchRibbonApps,
    readCachedRibbonApps,
    toRibbonApps,
    writeCachedRibbonApps,
} from "./marketplaceApps";

// Shape of a live `/api/platforms` entry.
const platform = (overrides: Record<string, unknown> = {}) => ({
    id: "80hours",
    name: "80hours Task Manager",
    description: "Tasks",
    category: "Productivity",
    logoUrl: "https://80hours.postplatforms.com/logo.svg",
    url: "https://80hours.postplatforms.com",
    ename: "@29217af0",
    ...overrides,
});

function memoryStorage() {
    const data = new Map<string, string>();
    return {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
    };
}

describe("toRibbonApps", () => {
    it("maps a platform to a ribbon entry", () => {
        expect(toRibbonApps({ platforms: [platform()], count: 1 })).toEqual([
            {
                key: "@29217af0",
                name: "80hours Task Manager",
                category: "Productivity",
                logo: "https://80hours.postplatforms.com/logo.svg",
                url: "https://80hours.postplatforms.com/",
            },
        ]);
    });

    it("keeps the endpoint's order", () => {
        const apps = toRibbonApps({
            platforms: [
                platform({ ename: "@a", name: "A", url: "https://a.test" }),
                platform({ ename: "@b", name: "B", url: "https://b.test" }),
            ],
        });
        expect(apps.map((a) => a.name)).toEqual(["A", "B"]);
    });

    it("skips platforms without an https link", () => {
        const apps = toRibbonApps({
            platforms: [
                platform({ ename: "@1", url: "" }),
                platform({ ename: "@2", url: "http://plain.test" }),
                platform({ ename: "@3", url: "javascript:alert(1)" }),
                platform({ ename: "@4", url: null }),
            ],
        });
        expect(apps).toEqual([]);
    });

    it("skips platforms without a name", () => {
        expect(toRibbonApps({ platforms: [platform({ name: "  " })] })).toEqual(
            [],
        );
    });

    it("drops logos that are not https", () => {
        const [app] = toRibbonApps({
            platforms: [platform({ logoUrl: "http://x.test/logo.png" })],
        });
        expect(app.logo).toBeNull();
        const [noLogo] = toRibbonApps({
            platforms: [platform({ logoUrl: null })],
        });
        expect(noLogo.logo).toBeNull();
    });

    it("drops repeats by eName or by link", () => {
        const apps = toRibbonApps({
            platforms: [
                platform(),
                platform({ name: "Again" }),
                platform({ ename: "@other", name: "Same link" }),
            ],
        });
        expect(apps).toHaveLength(1);
    });

    it("falls back to the link as key when there is no eName", () => {
        const [app] = toRibbonApps({ platforms: [platform({ ename: "" })] });
        expect(app.key).toBe("https://80hours.postplatforms.com/");
    });

    it("tolerates a missing category", () => {
        const [app] = toRibbonApps({
            platforms: [platform({ category: undefined })],
        });
        expect(app.category).toBe("");
    });

    it("returns [] for unexpected payloads", () => {
        expect(toRibbonApps(null)).toEqual([]);
        expect(toRibbonApps({})).toEqual([]);
        expect(toRibbonApps({ platforms: "nope" })).toEqual([]);
        expect(toRibbonApps({ platforms: [null, 3, "x"] })).toEqual([]);
    });
});

describe("fetchRibbonApps", () => {
    it("reads /api/platforms from the marketplace", async () => {
        const fetchFn = vi.fn(
            async () =>
                new Response(JSON.stringify({ platforms: [platform()] }), {
                    status: 200,
                }),
        );
        const apps = await fetchRibbonApps(
            fetchFn as unknown as typeof fetch,
            "https://market.test",
        );
        expect(fetchFn).toHaveBeenCalledWith(
            "https://market.test/api/platforms",
            expect.objectContaining({ method: "GET" }),
        );
        expect(apps).toHaveLength(1);
    });

    it("throws on an HTTP error", async () => {
        const fetchFn = vi.fn(async () => new Response("", { status: 502 }));
        await expect(
            fetchRibbonApps(fetchFn as unknown as typeof fetch),
        ).rejects.toThrow("502");
    });

    it("propagates network errors", async () => {
        const fetchFn = vi.fn(async () => {
            throw new TypeError("offline");
        });
        await expect(
            fetchRibbonApps(fetchFn as unknown as typeof fetch),
        ).rejects.toThrow("offline");
    });
});

describe("ribbon cache", () => {
    it("round-trips the last list", () => {
        const storage = memoryStorage();
        const apps = toRibbonApps({
            platforms: [
                platform(),
                platform({ ename: "", url: "https://b.test" }),
            ],
        });
        writeCachedRibbonApps(apps, storage);
        expect(readCachedRibbonApps(storage)).toEqual(apps);
    });

    it("returns null when empty or corrupt", () => {
        const storage = memoryStorage();
        expect(readCachedRibbonApps(storage)).toBeNull();
        storage.setItem("marketplace-ribbon-apps:v1", "{not json");
        expect(readCachedRibbonApps(storage)).toBeNull();
        storage.setItem("marketplace-ribbon-apps:v1", "[]");
        expect(readCachedRibbonApps(storage)).toBeNull();
    });

    it("re-validates cached entries", () => {
        const storage = memoryStorage();
        storage.setItem(
            "marketplace-ribbon-apps:v1",
            JSON.stringify([{ name: "Evil", url: "javascript:alert(1)" }]),
        );
        expect(readCachedRibbonApps(storage)).toBeNull();
    });

    it("never throws when storage is unavailable", () => {
        const broken = {
            getItem: () => {
                throw new Error("denied");
            },
            setItem: () => {
                throw new Error("full");
            },
        };
        expect(readCachedRibbonApps(broken)).toBeNull();
        expect(() => writeCachedRibbonApps([], broken)).not.toThrow();
    });
});
