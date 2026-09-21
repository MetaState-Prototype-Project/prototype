/**
 * Validation for the remotely-served correction catalog.
 *
 * Kept free of `$lib` and rune imports so it can be unit-tested in the plain
 * Node vitest environment.
 */

import enMessages from "../../../messages/en.json";
import { locales } from "../paraglide/runtime.js";

/** Rejected whole rather than applied partially when the remote file's shape
 *  no longer matches what this build understands. */
export const CATALOG_FORMAT_VERSION = 1;

/** Screens where the wording itself can talk someone into revealing a secret,
 *  or into approving something the confirmation misdescribes. These ship in
 *  the binary and are never replaceable from the network. */
export const PROTECTED_PREFIXES = [
    "passphrase_",
    "pin_",
    "reveal_",
    "signing_",
];

const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g;
const KNOWN_LOCALES = new Set<string>(locales);

const baseText = new Map<string, string>();
// Variant messages compile to a plural-form selector rather than a flat
// string, so a replacement string cannot express Slavic one/few/many.
const variantKeys = new Set<string>();

for (const [key, value] of Object.entries(
    enMessages as Record<string, unknown>,
)) {
    if (key === "$schema") continue;
    if (Array.isArray(value)) variantKeys.add(key);
    else if (typeof value === "string") baseText.set(key, value);
}

/** Substitutes `{name}` placeholders in a correction with the same inputs the
 *  compiled message would have received. */
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
    | "protected-key"
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
    if (PROTECTED_PREFIXES.some((prefix) => key.startsWith(prefix)))
        return "protected-key";
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
