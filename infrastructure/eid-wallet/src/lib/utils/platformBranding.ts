/**
 * Optional branding a platform may pass in a `w3ds://auth` link: `name` for
 * the approval card's title and `logo` for its icon. Both are claims made by
 * whoever generated the QR code, so they are cleaned here and always shown
 * next to the redirect hostname, which stays the source of truth.
 */

export interface PlatformBranding {
    name: string | null;
    logo: string | null;
}

const MAX_NAME_LENGTH = 64;
const MAX_LOGO_LENGTH = 2048;

/**
 * Trims a display name, removing control and invisible formatting characters
 * (including bidi overrides that could disguise it), and caps its length.
 */
export function cleanPlatformName(
    value: string | null | undefined,
): string | null {
    if (!value) return null;
    const name = value
        .replace(/[\p{Cc}\p{Cf}]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
    if (!name) return null;
    const chars = Array.from(name);
    return chars.length > MAX_NAME_LENGTH
        ? `${chars
              .slice(0, MAX_NAME_LENGTH - 1)
              .join("")
              .trimEnd()}…`
        : name;
}

/** Accepts only a plain https URL, so the wallet never loads anything else. */
export function cleanPlatformLogo(
    value: string | null | undefined,
): string | null {
    if (!value || value.length > MAX_LOGO_LENGTH) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password) {
            return null;
        }
        return url.toString();
    } catch {
        return null;
    }
}

export function readPlatformBranding(params: {
    get(name: string): string | null;
}): PlatformBranding {
    return {
        name: cleanPlatformName(params.get("name")),
        logo: cleanPlatformLogo(params.get("logo")),
    };
}
