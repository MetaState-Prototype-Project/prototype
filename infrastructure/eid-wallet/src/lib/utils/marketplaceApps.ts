/**
 * Apps for the main screen's ribbon, read live from the marketplace's
 * `GET /api/platforms`. That endpoint lists the platforms published through
 * Awareness (AaaS); the marketplace already drops drafts, archived and
 * in-review entries.
 *
 * The endpoint sends no CORS headers, so inside the app the request goes
 * through the Tauri HTTP plugin (native, not subject to CORS). The host is
 * allow-listed in `src-tauri/capabilities/*.json`.
 *
 * Entries are published by the platforms themselves, so names are cleaned and
 * only https links and logos are kept. A platform without its own https link
 * opens its page on the marketplace instead, as the marketplace site does.
 */
import { cleanPlatformLogo, cleanPlatformName } from "./platformBranding";

export const MARKETPLACE_URL = "https://marketplace.w3ds.metastate.foundation";

const CACHE_KEY = "marketplace-ribbon-apps:v1";
const REQUEST_TIMEOUT_MS = 10_000;

export interface RibbonApp {
    /** Stable key: the platform's eName, or its id/URL when it has none. */
    key: string;
    /** The marketplace's id for the platform, used for its marketplace page. */
    id: string;
    name: string;
    /** English category as published, e.g. "Productivity". May be empty. */
    category: string;
    logo: string | null;
    /** The platform's own site, or its marketplace page when it has none. */
    url: string;
}

/**
 * Turns a `/api/platforms` response into ribbon entries. Entries without a
 * usable name, or without both a link and an id, are skipped, as are repeats
 * of the same app.
 */
export function toRibbonApps(
    payload: unknown,
    marketplaceUrl = MARKETPLACE_URL,
): RibbonApp[] {
    const items = (payload as { platforms?: unknown } | null)?.platforms;
    if (!Array.isArray(items)) return [];

    const seen = new Set<string>();
    const apps: RibbonApp[] = [];
    for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const { id, name, category, logoUrl, url, ename } = item as Record<
            string,
            unknown
        >;
        const cleanName = cleanPlatformName(asString(name));
        if (!cleanName) continue;
        const appId = asString(id)?.trim() ?? "";
        const ownLink = cleanPlatformLogo(asString(url));
        const link =
            ownLink ??
            (appId ? marketplacePageUrl(appId, marketplaceUrl) : null);
        if (!link) continue;

        const key = asString(ename)?.trim() || link;
        if (seen.has(key) || seen.has(link)) continue;
        seen.add(key);
        seen.add(link);

        apps.push({
            key,
            id: appId,
            name: cleanName,
            category: cleanPlatformName(asString(category)) ?? "",
            logo: cleanPlatformLogo(asString(logoUrl)),
            url: link,
        });
    }
    return apps;
}

/** The platform's detail page on the marketplace site. */
export function marketplacePageUrl(
    id: string,
    marketplaceUrl = MARKETPLACE_URL,
): string | null {
    try {
        return cleanPlatformLogo(
            new URL(
                `/app/${encodeURIComponent(id)}`,
                marketplaceUrl,
            ).toString(),
        );
    } catch {
        return null;
    }
}

/** Fetches the live list. Throws on network or HTTP errors. */
export async function fetchRibbonApps(
    fetchFn?: typeof fetch,
    baseUrl = MARKETPLACE_URL,
): Promise<RibbonApp[]> {
    const doFetch = fetchFn ?? (await resolveFetch());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const res = await doFetch(`${baseUrl}/api/platforms`, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Marketplace returned ${res.status}`);
        const body: unknown = await res.json();
        // When Awareness is down the marketplace still answers 200, with an
        // empty list and an `error` field. Treat that as a failure so callers
        // keep the last list they had instead of showing an empty one.
        const failure = (body as { error?: unknown } | null)?.error;
        if (failure) {
            throw new Error(`Marketplace could not list platforms: ${failure}`);
        }
        return toRibbonApps(body, baseUrl);
    } finally {
        clearTimeout(timer);
    }
}

/** The last list that loaded successfully, or null. */
export function readCachedRibbonApps(
    storage: Pick<Storage, "getItem"> | undefined = safeStorage(),
): RibbonApp[] | null {
    try {
        const raw = storage?.getItem(CACHE_KEY);
        if (!raw) return null;
        const apps = toRibbonApps({ platforms: JSON.parse(raw) });
        return apps.length ? apps : null;
    } catch {
        return null;
    }
}

export function writeCachedRibbonApps(
    apps: RibbonApp[],
    storage: Pick<Storage, "setItem"> | undefined = safeStorage(),
): void {
    try {
        // Stored in the endpoint's own shape so reading goes through the
        // same validation as a fresh response.
        storage?.setItem(
            CACHE_KEY,
            JSON.stringify(
                apps.map((a) => ({
                    id: a.id,
                    ename: a.key,
                    name: a.name,
                    category: a.category,
                    logoUrl: a.logo,
                    url: a.url,
                })),
            ),
        );
    } catch {
        // Storage full or unavailable: the next launch just refetches.
    }
}

// Inside the app, use the native client (no CORS). In a plain browser
// (vite dev), fall back to window.fetch, which the missing CORS headers block,
// so the ribbon shows the cached list or nothing there.
async function resolveFetch(): Promise<typeof fetch> {
    const { isTauri } = await import("@tauri-apps/api/core");
    if (isTauri()) {
        const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
        return tauriFetch as typeof fetch;
    }
    return fetch;
}

function safeStorage(): Storage | undefined {
    try {
        return globalThis.localStorage;
    } catch {
        return undefined;
    }
}

function asString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}
