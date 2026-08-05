import { createHash } from "node:crypto";

/**
 * The claims the bridge puts in the ID token, derived from an eName.
 *
 * This is the whole of the fragile logic in this service, deliberately kept in a
 * pure function with no dependencies so it can be tested exhaustively.
 */
export interface W3dsClaims {
    /** The full eName. This is the identity; it must never be ambiguous. */
    sub: string;
    /**
     * The same value in both, so the result is identical whichever of Forgejo's
     * USERNAME settings the instance uses.
     *
     * Empty when the eName cannot be mapped to an acceptable username. It must be
     * **present and empty, never absent** — see `sanitiseUsername`.
     */
    nickname: string;
    preferred_username: string;
    email: string;
    /** Synthetic and undeliverable, so saying otherwise would be a lie. */
    email_verified: false;
}

export interface ClaimOptions {
    emailDomain: string;
    /** Lower-cased names this instance reserves on top of Forgejo's own. */
    extraReservedUsernames?: string[];
}

/**
 * Copied from GitW3 `models/user/user.go:639`. Kept as a literal rather than
 * fetched, because it changes only when upstream changes and a silent drift is
 * better caught by a failing login in staging than by an unavailable service.
 */
const RESERVED_USERNAMES = [
    ".",
    "..",
    "-",
    ".well-known",
    "api",
    "metrics",
    "v2",
    "assets",
    "attachments",
    "avatar",
    "avatars",
    "repo-avatars",
    "captcha",
    "login",
    "org",
    "repo",
    "user",
    "admin",
    "explore",
    "issues",
    "pulls",
    "milestones",
    "notifications",
    "report_abuse",
    "favicon.ico",
    "manifest.json",
    "robots.txt",
    "sitemap.xml",
    "ssh_info",
    "swagger.v1.json",
    "ghost",
    "gitea-actions",
    "forgejo-actions",
];

/** Also from `models/user/user.go`. Forgejo matches these as suffixes. */
const RESERVED_SUFFIXES = [".keys", ".gpg", ".rss", ".atom", ".png"];

/** Forgejo's `RegisterForm`, which the account-linking page binds. */
const MAX_USERNAME_LENGTH = 40;

/**
 * Mirrors Forgejo's own normalisation (`models/user/user.go:630`): decompose,
 * drop combining marks, and expand the two characters it special-cases. Without
 * this, `@josé` would lose its last letter to the character filter rather than
 * becoming `jose`.
 */
function foldDiacritics(value: string): string {
    return value
        .replace(/Æ/g, "AE")
        .replace(/æ/g, "ae")
        .replace(/ß/g, "ss")
        .normalize("NFD")
        .replace(/\p{Mn}/gu, "");
}

function stripLeadingAt(ename: string): string {
    return ename.startsWith("@") ? ename.slice(1) : ename;
}

/**
 * An eName to a username Forgejo will accept, or the empty string when there
 * isn't one.
 *
 * Empty is the deliberate fallback rather than an invented prefix: Forgejo
 * already routes an empty `nickname` to its account-linking page, where the
 * person picks their own name. Callers must still emit the claim — see
 * `buildClaims`.
 */
export function sanitiseUsername(
    ename: string,
    extraReserved: string[] = [],
): string {
    const candidate = foldDiacritics(stripLeadingAt(ename))
        // Anything outside Forgejo's character set, including any interior @,
        // which would otherwise reach getUserName and be split on.
        .replace(/[^0-9A-Za-z_.-]/g, "-")
        // `[-._]{2,}` is forbidden outright by Forgejo's negative pattern.
        .replace(/[-._]{2,}/g, "-")
        // A username must start with an alphanumeric and may not end with a
        // separator.
        .replace(/^[-._]+/, "")
        .replace(/[-._]+$/, "")
        .slice(0, MAX_USERNAME_LENGTH)
        // Truncation can land on a separator, which the negative pattern also
        // forbids at the end.
        .replace(/[-._]+$/, "");

    if (!candidate) return "";

    // Forgejo lower-cases before comparing (`models/db/name.go:113`), so a
    // case-sensitive check here would let @Admin through.
    const lowered = candidate.toLowerCase();
    if (RESERVED_USERNAMES.includes(lowered)) return "";
    if (RESERVED_SUFFIXES.some((suffix) => lowered.endsWith(suffix))) return "";
    if (extraReserved.includes(lowered)) return "";

    return candidate;
}

/**
 * The local part of the synthetic address.
 *
 * Derived from the eName rather than from the username, so that two eNames which
 * collapse to the same username still carry distinct addresses and the email is
 * never itself the cause of a false conflict.
 *
 * Dots get stricter treatment than the username needs: Forgejo parses the
 * address with Go's `mail.ParseAddress`, and a dot-atom may not begin, end, or
 * double up on dots.
 */
function emailLocalPart(ename: string): string {
    const local = foldDiacritics(stripLeadingAt(ename))
        .replace(/[^0-9A-Za-z._-]/g, "-")
        .replace(/\.{2,}/g, ".")
        .replace(/^\.+/, "")
        .replace(/\.+$/, "");

    if (local) return local;

    // Nothing usable survived — an eName of pure punctuation. Fall back to
    // something deterministic and unique rather than emitting an address Forgejo
    // will refuse.
    return `w3ds-${createHash("sha256").update(ename).digest("hex").slice(0, 12)}`;
}

export function buildClaims(ename: string, options: ClaimOptions): W3dsClaims {
    const username = sanitiseUsername(
        ename,
        options.extraReservedUsernames ?? [],
    );

    return {
        sub: ename,
        // Both keys are always present. An absent `preferred_username` panics
        // Forgejo's account-linking page: getUserName does an unchecked type
        // assertion on it (`routers/web/auth/auth.go:405`). Do not "clean this up"
        // by dropping empty claims.
        nickname: username,
        preferred_username: username,
        email: `${emailLocalPart(ename)}@${options.emailDomain}`,
        email_verified: false,
    };
}
