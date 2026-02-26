/**
 * W3DS Gateway — Platform Capabilities
 *
 * Static map of which platforms can handle which schema types, with URL templates
 * for deep-linking into each platform.
 *
 * This is derived from the .mapping.json files across all platforms and the
 * route structures of each platform's frontend.
 *
 * Environment variable keys for each platform's base URL:
 *   Pictique:         PUBLIC_PICTIQUE_BASE_URL
 *   Blabsy:           PUBLIC_BLABSY_BASE_URL
 *   File Manager:     PUBLIC_FILE_MANAGER_BASE_URL
 *   eSigner:          PUBLIC_ESIGNER_BASE_URL
 *   eVoting:          PUBLIC_EVOTING_BASE_URL
 *   DreamSync:        VITE_DREAMSYNC_BASE_URL
 *   eCurrency:        VITE_ECURRENCY_BASE_URL
 *   eReputation:      VITE_EREPUTATION_BASE_URL
 *   Cerberus:         PUBLIC_CERBERUS_BASE_URL
 *   Group Charter:    PUBLIC_GROUP_CHARTER_BASE_URL
 *   eMoving:          PUBLIC_EMOVER_BASE_URL
 */

import { SchemaIds } from "./schemas.js";
import type { PlatformHandler } from "./types.js";

/**
 * Maps each schema ID to the list of platforms that can handle it,
 * with URL templates for constructing deep links.
 */
export const PLATFORM_CAPABILITIES: Record<string, PlatformHandler[]> = {
    // ──────────────────────────────────────────────────
    // User Profile
    // ──────────────────────────────────────────────────
    [SchemaIds.User]: [
        {
            platformKey: "pictique",
            platformName: "Pictique",
            urlTemplate: "{baseUrl}/profile/{entityId}",
            label: "View profile on Pictique",
            icon: "pictique",
        },
        {
            platformKey: "blabsy",
            platformName: "Blabsy",
            urlTemplate: "{baseUrl}/user/{entityId}",
            label: "View profile on Blabsy",
            icon: "blabsy",
        },
    ],

    // ──────────────────────────────────────────────────
    // Social Media Post (tweet / photo post / comment)
    // ──────────────────────────────────────────────────
    [SchemaIds.SocialMediaPost]: [
        {
            platformKey: "pictique",
            platformName: "Pictique",
            urlTemplate: "{baseUrl}/home",
            label: "View on Pictique",
            icon: "pictique",
        },
        {
            platformKey: "blabsy",
            platformName: "Blabsy",
            urlTemplate: "{baseUrl}/tweet/{entityId}",
            label: "View tweet on Blabsy",
            icon: "blabsy",
        },
    ],

    // ──────────────────────────────────────────────────
    // Group / Chat
    // ──────────────────────────────────────────────────
    [SchemaIds.Group]: [
        {
            platformKey: "pictique",
            platformName: "Pictique",
            urlTemplate: "{baseUrl}/group/{entityId}",
            label: "Open group on Pictique",
            icon: "pictique",
        },
        {
            platformKey: "blabsy",
            platformName: "Blabsy",
            urlTemplate: "{baseUrl}/chat?chatId={entityId}",
            label: "Open chat on Blabsy",
            icon: "blabsy",
        },
        {
            platformKey: "group-charter",
            platformName: "Group Charter",
            urlTemplate: "{baseUrl}/charter/{entityId}",
            label: "View charter",
            icon: "group-charter",
        },
    ],

    // ──────────────────────────────────────────────────
    // Message
    // ──────────────────────────────────────────────────
    [SchemaIds.Message]: [
        {
            platformKey: "pictique",
            platformName: "Pictique",
            urlTemplate: "{baseUrl}/messages/{entityId}",
            label: "Open conversation on Pictique",
            icon: "pictique",
        },
        {
            platformKey: "blabsy",
            platformName: "Blabsy",
            urlTemplate: "{baseUrl}/chat?chatId={entityId}",
            label: "Open chat on Blabsy",
            icon: "blabsy",
        },
    ],

    // ──────────────────────────────────────────────────
    // Voting Observation
    // ──────────────────────────────────────────────────
    [SchemaIds.VotingObservation]: [
        {
            platformKey: "cerberus",
            platformName: "Cerberus",
            urlTemplate: "{baseUrl}",
            label: "View on Cerberus",
            icon: "cerberus",
        },
        {
            platformKey: "ereputation",
            platformName: "eReputation",
            urlTemplate: "{baseUrl}",
            label: "View on eReputation",
            icon: "ereputation",
        },
    ],

    // ──────────────────────────────────────────────────
    // Ledger (financial transaction)
    // ──────────────────────────────────────────────────
    [SchemaIds.Ledger]: [
        {
            platformKey: "ecurrency",
            platformName: "eCurrency",
            urlTemplate: "{baseUrl}/dashboard",
            label: "View transaction on eCurrency",
            icon: "ecurrency",
        },
    ],

    // ──────────────────────────────────────────────────
    // Currency
    // ──────────────────────────────────────────────────
    [SchemaIds.Currency]: [
        {
            platformKey: "ecurrency",
            platformName: "eCurrency",
            urlTemplate: "{baseUrl}/currency/{entityId}",
            label: "View currency on eCurrency",
            icon: "ecurrency",
        },
    ],

    // ──────────────────────────────────────────────────
    // Poll
    // ──────────────────────────────────────────────────
    [SchemaIds.Poll]: [
        {
            platformKey: "evoting",
            platformName: "eVoting",
            urlTemplate: "{baseUrl}/{entityId}",
            label: "View poll on eVoting",
            icon: "evoting",
        },
        {
            platformKey: "ereputation",
            platformName: "eReputation",
            urlTemplate: "{baseUrl}",
            label: "View on eReputation",
            icon: "ereputation",
        },
    ],

    // ──────────────────────────────────────────────────
    // Vote (individual vote cast)
    // ──────────────────────────────────────────────────
    [SchemaIds.Vote]: [
        {
            platformKey: "evoting",
            platformName: "eVoting",
            urlTemplate: "{baseUrl}/{entityId}",
            label: "View vote on eVoting",
            icon: "evoting",
        },
    ],

    // ──────────────────────────────────────────────────
    // Vote Reputation Result
    // ──────────────────────────────────────────────────
    [SchemaIds.VoteReputationResult]: [
        {
            platformKey: "evoting",
            platformName: "eVoting",
            urlTemplate: "{baseUrl}/{entityId}",
            label: "View results on eVoting",
            icon: "evoting",
        },
        {
            platformKey: "ereputation",
            platformName: "eReputation",
            urlTemplate: "{baseUrl}",
            label: "View on eReputation",
            icon: "ereputation",
        },
    ],

    // ──────────────────────────────────────────────────
    // Wishlist
    // ──────────────────────────────────────────────────
    [SchemaIds.Wishlist]: [
        {
            platformKey: "dreamsync",
            platformName: "DreamSync",
            urlTemplate: "{baseUrl}",
            label: "Open in DreamSync",
            icon: "dreamsync",
        },
    ],

    // ──────────────────────────────────────────────────
    // Charter Signature
    // ──────────────────────────────────────────────────
    [SchemaIds.CharterSignature]: [
        {
            platformKey: "group-charter",
            platformName: "Group Charter",
            urlTemplate: "{baseUrl}/charter/{entityId}",
            label: "View charter signature",
            icon: "group-charter",
        },
    ],

    // ──────────────────────────────────────────────────
    // Reference Signature
    // ──────────────────────────────────────────────────
    [SchemaIds.ReferenceSignature]: [
        {
            platformKey: "ereputation",
            platformName: "eReputation",
            urlTemplate: "{baseUrl}",
            label: "View reference on eReputation",
            icon: "ereputation",
        },
    ],

    // ──────────────────────────────────────────────────
    // File
    // ──────────────────────────────────────────────────
    [SchemaIds.File]: [
        {
            platformKey: "file-manager",
            platformName: "File Manager",
            urlTemplate: "{baseUrl}/files/{entityId}",
            label: "Open in File Manager",
            icon: "file-manager",
        },
        {
            platformKey: "esigner",
            platformName: "eSigner",
            urlTemplate: "{baseUrl}/files/{entityId}",
            label: "Open in eSigner",
            icon: "esigner",
        },
    ],

    // ──────────────────────────────────────────────────
    // Signature Container
    // ──────────────────────────────────────────────────
    [SchemaIds.SignatureContainer]: [
        {
            platformKey: "esigner",
            platformName: "eSigner",
            urlTemplate: "{baseUrl}/files/{entityId}",
            label: "View in eSigner",
            icon: "esigner",
        },
        {
            platformKey: "file-manager",
            platformName: "File Manager",
            urlTemplate: "{baseUrl}/files/{entityId}",
            label: "View in File Manager",
            icon: "file-manager",
        },
    ],
};

/**
 * Maps platform keys to their environment variable names for **client** (frontend) URL resolution.
 * Where available, uses `_URL` (client) vars rather than `_BASE_URL` (API) vars.
 * Platforms without a dedicated `_URL` var use `_BASE_URL` as a best-effort fallback.
 */
export const PLATFORM_ENV_KEYS: Record<string, string> = {
    pictique: "PUBLIC_PICTIQUE_URL",              // client URL
    blabsy: "PUBLIC_BLABSY_URL",                  // client URL
    "file-manager": "PUBLIC_FILE_MANAGER_BASE_URL", // no _URL var — falls back to API
    esigner: "PUBLIC_ESIGNER_BASE_URL",            // no _URL var — falls back to API
    evoting: "PUBLIC_EVOTING_URL",                 // client URL
    dreamsync: "VITE_DREAMSYNC_BASE_URL",          // no _URL var — falls back to API
    ecurrency: "VITE_ECURRENCY_BASE_URL",          // no _URL var — falls back to API
    ereputation: "VITE_EREPUTATION_BASE_URL",      // no _URL var — falls back to API
    cerberus: "PUBLIC_CERBERUS_BASE_URL",          // API only
    "group-charter": "PUBLIC_GROUP_CHARTER_BASE_URL", // no _URL var
    emover: "PUBLIC_EMOVER_BASE_URL",              // no _URL var
};

/**
 * Default development platform CLIENT URLs.
 * These are the frontend URLs where users actually browse.
 * Platforms call `configurePlatformUrls()` at startup to override
 * with production URLs from their env.
 *
 * Ports sourced from .env.example and platform package.json configs.
 */
const DEFAULT_PLATFORM_URLS: Record<string, string> = {
    pictique: "http://localhost:5173",        // SvelteKit default — PUBLIC_PICTIQUE_URL
    blabsy: "http://localhost:8080",           // next dev -p 8080 — PUBLIC_BLABSY_URL
    "file-manager": "http://localhost:5174",   // SvelteKit — needs --port 5174 to avoid conflicts
    esigner: "http://localhost:5175",           // SvelteKit — needs --port 5175
    evoting: "http://localhost:3001",           // next dev — PUBLIC_EVOTING_URL
    dreamsync: "http://localhost:5176",         // Vite React — needs --port 5176
    ecurrency: "http://localhost:9888",         // Vite React — explicit port in vite.config.ts
    ereputation: "http://localhost:5178",       // Vite React — needs --port 5178
    cerberus: "http://localhost:6666",          // API-only — PUBLIC_CERBERUS_BASE_URL
    "group-charter": "http://localhost:3000",   // next dev — default port
    emover: "http://localhost:3006",            // next dev -p 3006
};

let _platformUrls: Record<string, string> = { ...DEFAULT_PLATFORM_URLS };

/**
 * Configure platform base URLs at startup. Call this once in your app's
 * entry point, passing the URLs read from your framework's env.
 *
 * @example SvelteKit platform:
 * ```ts
 * import { configurePlatformUrls, PLATFORM_ENV_KEYS } from "w3ds-gateway";
 * import { env } from "$env/dynamic/public";
 *
 * configurePlatformUrls(
 *   Object.fromEntries(
 *     Object.entries(PLATFORM_ENV_KEYS)
 *       .map(([key, envVar]) => [key, env[envVar]])
 *       .filter(([, url]) => url)
 *   )
 * );
 * ```
 *
 * @example Vite (React) platform:
 * ```ts
 * import { configurePlatformUrls, PLATFORM_ENV_KEYS } from "w3ds-gateway";
 *
 * configurePlatformUrls(
 *   Object.fromEntries(
 *     Object.entries(PLATFORM_ENV_KEYS)
 *       .map(([key, envVar]) => [key, import.meta.env[envVar]])
 *       .filter(([, url]) => url)
 *   )
 * );
 * ```
 */
export function configurePlatformUrls(urls: Record<string, string>): void {
    _platformUrls = { ..._platformUrls, ...urls };
}

/**
 * Get the currently configured platform URLs.
 * Returns whatever was set via `configurePlatformUrls()`.
 */
export function getPlatformUrls(): Record<string, string> {
    return { ..._platformUrls };
}
