import { describe, expect, it, vi } from "vitest";
import { fetchRibbonApps, toRibbonApps } from "./marketplaceApps";

const BASE = "https://marketplace.example";

describe("toRibbonApps", () => {
    it("maps marketplace entries and prefers bundled logos", () => {
        const apps = toRibbonApps(
            {
                apps: [
                    {
                        id: "blabsy",
                        name: "Blabsy",
                        category: "Social",
                        logoUrl: "/blabsy.svg",
                        url: "https://blabsy.example",
                    },
                    {
                        id: "charter",
                        name: "Charter Manager",
                        category: "Governance",
                        logoUrl: "/charter.png",
                        url: "https://charter.example",
                    },
                ],
            },
            BASE,
        );
        expect(apps).toEqual([
            {
                id: "blabsy",
                name: "Blabsy",
                category: "Social",
                logo: "/images/Logo-Blabsy.svg",
                url: "https://blabsy.example/",
            },
            {
                id: "charter",
                name: "Charter Manager",
                category: "Governance",
                logo: `${BASE}/charter.png`,
                url: "https://charter.example/",
            },
        ]);
    });

    it("skips apps without an https link, and duplicates", () => {
        const apps = toRibbonApps({
            apps: [
                { id: "eid-wallet", name: "eID", appStoreUrl: "https://x" },
                { id: "bad", name: "Bad", url: "javascript:alert(1)" },
                { id: "plain", name: "Plain", url: "http://plain.example" },
                { id: "a", name: "A", url: "https://a.example" },
                { id: "a", name: "A again", url: "https://a2.example" },
            ],
        });
        expect(apps.map((a) => a.id)).toEqual(["a"]);
    });

    it("drops logos that are not https", () => {
        const [app] = toRibbonApps({
            apps: [
                {
                    id: "x",
                    name: "X",
                    logoUrl: "data:image/png;base64,AAAA",
                    url: "https://x.example",
                },
            ],
        });
        expect(app.logo).toBeNull();
        expect(app.category).toBe("");
    });

    it("returns nothing for a malformed payload", () => {
        expect(toRibbonApps(null)).toEqual([]);
        expect(toRibbonApps({ apps: "nope" })).toEqual([]);
    });
});

describe("fetchRibbonApps", () => {
    it("throws on a non-2xx response", async () => {
        const fetchFn = vi.fn(async () => new Response("", { status: 502 }));
        await expect(fetchRibbonApps(BASE, fetchFn)).rejects.toThrow("502");
        expect(fetchFn).toHaveBeenCalledWith(`${BASE}/api/apps`);
    });
});
