import { describe, expect, it, vi } from "vitest";
import {
    fetchRibbonApps,
    marketplacePageUrl,
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
                id: "80hours",
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

    it("links a platform without an https link to its marketplace page", () => {
        const apps = toRibbonApps(
            {
                platforms: [
                    platform({ id: "a", ename: "@1", url: "" }),
                    platform({
                        id: "b",
                        ename: "@2",
                        url: "http://plain.test",
                    }),
                    platform({
                        id: "c",
                        ename: "@3",
                        url: "javascript:alert(1)",
                    }),
                    platform({ id: "d", ename: "@4", url: null }),
                ],
            },
            "https://market.test",
        );
        expect(apps.map((a) => a.url)).toEqual([
            "https://market.test/app/a",
            "https://market.test/app/b",
            "https://market.test/app/c",
            "https://market.test/app/d",
        ]);
    });

    it("keeps a live platform like Prikbord (no link, no logo)", () => {
        const [app] = toRibbonApps({
            platforms: [
                {
                    id: "prikbord",
                    name: "Prikbord — GWL Terrein",
                    description: "Neighbourhood time bank",
                    category: "Other",
                    logoUrl: null,
                    url: "",
                    ename: "@4da46106",
                },
            ],
        });
        expect(app).toEqual({
            key: "@4da46106",
            id: "prikbord",
            name: "Prikbord — GWL Terrein",
            category: "Other",
            logo: null,
            url: "https://marketplace.w3ds.metastate.foundation/app/prikbord",
        });
    });

    it("skips a platform with neither a link nor an id", () => {
        expect(
            toRibbonApps({ platforms: [platform({ id: "", url: "" })] }),
        ).toEqual([]);
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

    it("encodes ids with spaces in the marketplace link", () => {
        expect(marketplacePageUrl("tmatic FWM", "https://market.test")).toBe(
            "https://market.test/app/tmatic%20FWM",
        );
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

    it("throws when the marketplace reports an error with a 200", async () => {
        // What /api/platforms answers when Awareness is down.
        const fetchFn = vi.fn(
            async () =>
                new Response(JSON.stringify({ platforms: [], error: "x" }), {
                    status: 200,
                }),
        );
        await expect(
            fetchRibbonApps(fetchFn as unknown as typeof fetch),
        ).rejects.toThrow("x");
    });

    it("lets a caller keep its cached list when the marketplace reports an error", async () => {
        // Mirrors AppsMarketplace.svelte: start from the cache, replace it
        // only on success, and swallow failures.
        const storage = memoryStorage();
        writeCachedRibbonApps(
            toRibbonApps({ platforms: [platform()] }),
            storage,
        );
        let apps = readCachedRibbonApps(storage) ?? [];
        const fetchFn = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        platforms: [],
                        count: 0,
                        error: "AaaS down",
                    }),
                    { status: 200 },
                ),
        );

        await fetchRibbonApps(fetchFn as unknown as typeof fetch)
            .then((live) => {
                apps = live;
                if (live.length) writeCachedRibbonApps(live, storage);
            })
            .catch(() => {});

        expect(apps.map((a) => a.name)).toEqual(["80hours Task Manager"]);
        expect(readCachedRibbonApps(storage)).toHaveLength(1);
    });

    it("still treats an empty list without an error as a valid answer", async () => {
        const fetchFn = vi.fn(
            async () =>
                new Response(JSON.stringify({ platforms: [], count: 0 }), {
                    status: 200,
                }),
        );
        await expect(
            fetchRibbonApps(fetchFn as unknown as typeof fetch),
        ).resolves.toEqual([]);
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
