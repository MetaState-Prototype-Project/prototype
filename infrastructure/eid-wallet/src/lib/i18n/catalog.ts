import enMessages from "../../../messages/en.json";
import { locales } from "../paraglide/runtime.js";
// Shared with scripts/build-translations-catalog.mjs so the version the
// generator writes and the one this accepts cannot drift.
import policy from "./policy.json";

export const CATALOG_FORMAT_VERSION = policy.formatVersion;

const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g;
const KNOWN_LOCALES = new Set<string>(locales);

const baseText = new Map<string, string>();
// Variant messages compile to a plural-form selector, which a flat
// replacement string cannot express.
const variantKeys = new Set<string>();

for (const [key, value] of Object.entries(
    enMessages as Record<string, unknown>,
)) {
    if (key === "$schema") continue;
    if (Array.isArray(value)) variantKeys.add(key);
    else if (typeof value === "string") baseText.set(key, value);
}

export function fill(
    template: string,
    inputs?: Record<string, unknown>,
): string {
    if (!inputs) return template;
    return template.replace(PLACEHOLDER, (whole, name) =>
        name in inputs ? String(inputs[name]) : whole,
    );
}

export type RejectionReason =
    | "unknown-locale"
    | "unknown-key"
    | "variant-message"
    | "not-a-string"
    | "placeholder-mismatch";

export interface Rejection {
    locale: string;
    key: string;
    reason: RejectionReason;
}

export interface ValidationResult {
    accepted: Record<string, Record<string, string>>;
    rejected: Rejection[];
    /** Set when the file was discarded entirely; `accepted` is then empty. */
    fatal?: string;
}

function rejectionFor(
    key: string,
    value: unknown,
): RejectionReason | undefined {
    if (typeof value !== "string") return "not-a-string";
    if (variantKeys.has(key)) return "variant-message";
    const base = baseText.get(key);
    if (base === undefined) return "unknown-key";
    if (placeholdersOf(base) !== placeholdersOf(value))
        return "placeholder-mismatch";
    return undefined;
}

function placeholdersOf(text: string): string {
    return [...text.matchAll(PLACEHOLDER)]
        .map((match) => match[1])
        .sort()
        .join(",");
}

export function validateCatalog(raw: unknown): ValidationResult {
    const accepted: Record<string, Record<string, string>> = {};
    const rejected: Rejection[] = [];

    if (!raw || typeof raw !== "object")
        return { accepted, rejected, fatal: "not-an-object" };

    const root = raw as { version?: unknown; messages?: unknown };
    if (root.version !== CATALOG_FORMAT_VERSION)
        return {
            accepted,
            rejected,
            fatal: `unsupported-version:${root.version}`,
        };
    if (!root.messages || typeof root.messages !== "object")
        return { accepted, rejected, fatal: "missing-messages" };

    for (const [locale, entries] of Object.entries(
        root.messages as Record<string, unknown>,
    )) {
        if (!KNOWN_LOCALES.has(locale)) {
            rejected.push({ locale, key: "*", reason: "unknown-locale" });
            continue;
        }
        if (!entries || typeof entries !== "object") continue;
        for (const [key, value] of Object.entries(
            entries as Record<string, unknown>,
        )) {
            const reason = rejectionFor(key, value);
            if (reason) {
                rejected.push({ locale, key, reason });
                continue;
            }
            accepted[locale] ??= {};
            accepted[locale][key] = value as string;
        }
    }

    return { accepted, rejected };
}

// Publishing through a pull request protects the catalog at rest, not in
// transit: over plain HTTP anyone on the path can rewrite the copy on the PIN
// and recovery screens. Localhost is exempt so a dev server still works.
export function isTransportSafe(url: string): boolean {
    try {
        const { protocol, hostname } = new URL(url);
        if (protocol === "https:") return true;
        return (
            protocol === "http:" &&
            (hostname === "localhost" || hostname === "127.0.0.1")
        );
    } catch {
        return false;
    }
}
