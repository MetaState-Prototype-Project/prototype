import { cleanPlatformLogo, cleanPlatformName } from "./platformBranding";

export const MARKETPLACE_URL = "https://marketplace.w3ds.metastate.foundation";

export interface RibbonApp {
    id: string;
    name: string;
    /** English category from the marketplace, e.g. "Social". */
    category: string;
    logo: string | null;
    url: string;
}

// Wallet-styled logos, preferred over the marketplace's for these apps.
const BUNDLED_LOGOS: Record<string, string> = {
    blabsy: "/images/Logo-Blabsy.svg",
    pictique: "/images/Logo-Pictique.svg",
    evoting: "/images/Logo-eVoting.svg",
    ecurrency: "/images/Logo-eCurrency.svg",
    dreamsync: "/images/Logo-Dreamsync.svg",
};

/** Shown until the marketplace answers, and kept if it can't be reached. */
export const DEFAULT_RIBBON_APPS: RibbonApp[] = [
    ["blabsy", "Blabsy", "Social"],
    ["pictique", "Pictique", "Social"],
    ["evoting", "eVoting", "Governance"],
    ["ecurrency", "eCurrency", "Finance"],
    ["dreamsync", "Dreamsync", "Governance"],
].map(([id, name, category]) => ({
    id,
    name,
    category,
    logo: BUNDLED_LOGOS[id],
    url: `https://${id}.w3ds.metastate.foundation`,
}));

/**
 * Turns a marketplace `/api/apps` response into ribbon entries. Live entries
 * are published by the platforms themselves, so names are cleaned and only
 * https links and logos are kept. Apps without a web link (the wallet itself)
 * are skipped.
 */
export function toRibbonApps(
    payload: unknown,
    baseUrl = MARKETPLACE_URL,
): RibbonApp[] {
    const items = (payload as { apps?: unknown } | null)?.apps;
    if (!Array.isArray(items)) return [];

    const seen = new Set<string>();
    const apps: RibbonApp[] = [];
    for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const { id, name, category, logoUrl, url } = item as Record<
            string,
            unknown
        >;
        if (typeof id !== "string" || seen.has(id)) continue;
        const cleanName = cleanPlatformName(asString(name));
        const link = cleanPlatformLogo(asString(url));
        if (!cleanName || !link) continue;

        seen.add(id);
        apps.push({
            id,
            name: cleanName,
            category: cleanPlatformName(asString(category)) ?? "",
            logo: BUNDLED_LOGOS[id] ?? resolveLogo(asString(logoUrl), baseUrl),
            url: link,
        });
    }
    return apps;
}

export async function fetchRibbonApps(
    baseUrl = MARKETPLACE_URL,
    fetchFn: typeof fetch = fetch,
): Promise<RibbonApp[]> {
    const res = await fetchFn(`${baseUrl}/api/apps`);
    if (!res.ok) throw new Error(`Marketplace returned ${res.status}`);
    return toRibbonApps(await res.json(), baseUrl);
}

function asString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

// Curated marketplace logos are paths on the marketplace host ("/blabsy.svg").
function resolveLogo(value: string | null, baseUrl: string): string | null {
    if (!value) return null;
    try {
        return cleanPlatformLogo(new URL(value, baseUrl).toString());
    } catch {
        return null;
    }
}
