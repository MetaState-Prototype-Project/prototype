/**
 * W3DS Gateway — Resolver
 *
 * Resolves an eName + schemaId to a list of applications that can open the content.
 * Works entirely client-side using the static capabilities map and optional
 * Registry calls for dynamic platform URL resolution.
 */

import {
    PLATFORM_CAPABILITIES,
    getPlatformUrls,
    REGISTRY_PLATFORM_KEY_ORDER,
} from "./capabilities.js";
import { SchemaLabels } from "./schemas.js";
import type { SchemaId } from "./schemas.js";
import type {
    GatewayResolveInput,
    GatewayResolveResult,
    ResolvedApp,
} from "./types.js";

export interface GatewayResolverOptions {
    /**
     * Override platform base URLs. Keys are platform keys (e.g. "pictique").
     * If a platform key is not present here, falls back to the URLs set via `configurePlatformUrls()`.
     */
    platformUrls?: Record<string, string>;

    /**
     * Optional Registry base URL. If provided, the resolver will call
     * GET /platforms to retrieve live platform URLs.
     * If not provided, only static URLs from platformUrls / defaults are used.
     */
    registryUrl?: string;

    /**
     * Custom fetch function (useful for SSR or testing).
     * Defaults to globalThis.fetch.
     */
    fetch?: typeof globalThis.fetch;
}

/**
 * Fetches platform URLs from the Registry's /platforms endpoint.
 * Returns a map of platform keys to base URLs.
 */
async function fetchRegistryPlatforms(
    registryUrl: string,
    fetchFn: typeof globalThis.fetch,
): Promise<Record<string, string>> {
    try {
        const response = await fetchFn(`${registryUrl}/platforms`);
        if (!response.ok) return {};

        const urls: (string | null)[] = await response.json();

        const result: Record<string, string> = {};
        for (let i = 0; i < REGISTRY_PLATFORM_KEY_ORDER.length && i < urls.length; i++) {
            const url = urls[i];
            if (url) {
                result[REGISTRY_PLATFORM_KEY_ORDER[i]] = url;
            }
        }
        return result;
    } catch {
        return {};
    }
}

/**
 * Builds a concrete URL from a template and parameters.
 */
function buildUrl(
    template: string,
    baseUrl: string,
    entityId: string,
    ename: string,
): string {
    return template
        .replace("{baseUrl}", baseUrl.replace(/\/+$/, ""))
        .replace("{entityId}", encodeURIComponent(entityId))
        .replace("{ename}", encodeURIComponent(ename));
}

/**
 * Resolve an eName + schemaId to a list of applications that can open it.
 *
 * @example
 * ```ts
 * const result = await resolveEName({
 *   ename: "@e4d909c2-5d2f-4a7d-9473-b34b6c0f1a5a",
 *   schemaId: "550e8400-e29b-41d4-a716-446655440001", // SocialMediaPost
 *   entityId: "post-123",
 * });
 *
 * // result.apps → [
 * //   { platformName: "Pictique", url: "https://pictique.../home", ... },
 * //   { platformName: "Blabsy", url: "https://blabsy.../tweet/post-123", ... },
 * // ]
 * ```
 */
export async function resolveEName(
    input: GatewayResolveInput,
    options: GatewayResolverOptions = {},
): Promise<GatewayResolveResult> {
    const fetchFn = options.fetch ?? globalThis.fetch;
    const { ename, schemaId, entityId = "" } = input;

    // 1. Determine platform base URLs
    let platformUrls: Record<string, string> = {
        ...getPlatformUrls(),
    };

    // Merge in Registry URLs if available
    if (options.registryUrl) {
        const registryUrls = await fetchRegistryPlatforms(
            options.registryUrl,
            fetchFn,
        );
        platformUrls = { ...platformUrls, ...registryUrls };
    }

    // Merge in explicit overrides (highest priority)
    if (options.platformUrls) {
        platformUrls = { ...platformUrls, ...options.platformUrls };
    }

    // 2. Look up handlers for this schema
    const handlers = PLATFORM_CAPABILITIES[schemaId] ?? [];

    // 3. Build resolved app entries
    const apps: ResolvedApp[] = handlers
        .filter((handler) => platformUrls[handler.platformKey])
        .map((handler) => {
            const baseUrl = platformUrls[handler.platformKey];
            return {
                platformName: handler.platformName,
                platformKey: handler.platformKey,
                url: buildUrl(handler.urlTemplate, baseUrl, entityId, ename),
                label: handler.label,
                icon: handler.icon,
            };
        });

    // 4. Schema label
    const schemaLabel =
        SchemaLabels[schemaId as SchemaId] ?? "Unknown content type";

    return {
        ename,
        schemaId,
        schemaLabel,
        apps,
    };
}

/**
 * Synchronous version of resolveEName that doesn't fetch from Registry.
 * Uses only the provided platformUrls and/or defaults.
 */
export function resolveENameSync(
    input: GatewayResolveInput,
    platformUrls?: Record<string, string>,
): GatewayResolveResult {
    const { ename, schemaId, entityId = "" } = input;

    const urls: Record<string, string> = {
        ...getPlatformUrls(),
        ...platformUrls,
    };

    const handlers = PLATFORM_CAPABILITIES[schemaId] ?? [];

    const apps: ResolvedApp[] = handlers
        .filter((handler) => urls[handler.platformKey])
        .map((handler) => {
            const baseUrl = urls[handler.platformKey];
            return {
                platformName: handler.platformName,
                platformKey: handler.platformKey,
                url: buildUrl(handler.urlTemplate, baseUrl, entityId, ename),
                label: handler.label,
                icon: handler.icon,
            };
        });

    const schemaLabel =
        SchemaLabels[schemaId as SchemaId] ?? "Unknown content type";

    return {
        ename,
        schemaId,
        schemaLabel,
        apps,
    };
}
