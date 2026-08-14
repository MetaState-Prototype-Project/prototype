/**
 * Whether a GitW3 account's `login_name` is a W3DS ename, and if so, what it is.
 *
 * Kept as a one-line pure function, isolated from the admin-API call that
 * surrounds it (see `resolveEname`), so the one rule this whole design leans
 * on - login_name always begins with "@" when it was set by the w3ds-oidc-bridge,
 * because claims.ts's buildClaims sets `sub: ename` verbatim and Forgejo's OAuth2
 * callback writes LoginName = gothUser.UserID (= the ID token's `sub`) unchanged -
 * can be tested without any network access at all.
 *
 * A password-registered account's login_name is not an ename and never starts
 * with "@" - that account simply has no linked eVault, which is the ordinary
 * case, not a failure. See docs/superpowers/specs/2026-08-14-forgejo-code-sync-design.md
 * ("Identity resolution: pusher -> eName").
 */
export function enameFromLoginName(loginName: string): string | null {
    return loginName.startsWith("@") ? loginName : null;
}

interface CacheEntry {
    ename: string | null;
    expiresAt: number;
}

export interface IdentityResolverOptions {
    forgejoApiUrl: string;
    /** PAT on a dedicated site-admin service account - see the spec's Trust model. */
    adminToken: string;
    /** How long a resolved (or negative) result is trusted before re-fetching. */
    ttlMs?: number;
    fetchImpl?: typeof fetch;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000;

/**
 * Resolves a GitW3 username to its eName via `GET /api/v1/users/{username}`,
 * cached to avoid an admin-authenticated round trip on every push.
 *
 * `login_name` is only populated by that endpoint for an admin-or-self caller
 * (`services/convert/user.go`'s `toUser`, `authed = doer.ID == user.ID ||
 * doer.IsAdmin`) - confirmed against GitW3's own source, not assumed. A
 * `read:user`-scoped token belonging to a non-admin account gets back
 * `login_name: ""` for anyone but itself, which is why `FORGEJO_ADMIN_TOKEN`
 * must belong to a site-admin account, not merely carry that scope.
 */
export class IdentityResolver {
    private readonly cache = new Map<string, CacheEntry>();
    private readonly forgejoApiUrl: string;
    private readonly adminToken: string;
    private readonly ttlMs: number;
    private readonly fetchImpl: typeof fetch;

    constructor(options: IdentityResolverOptions) {
        this.forgejoApiUrl = options.forgejoApiUrl;
        this.adminToken = options.adminToken;
        this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }

    /**
     * Resolves a username to its eName, or `null` if the account has no linked
     * W3DS identity - the ordinary case for most GitW3 accounts, not a failure.
     * Throws on anything that looks like a transient infrastructure problem
     * (network error, non-404 non-2xx response), so the queue's drain loop can
     * tell "no eVault, skip" apart from "couldn't check right now, retry" - see
     * the spec's "Identity resolution" section.
     */
    async resolveEname(
        username: string,
        now = Date.now(),
    ): Promise<string | null> {
        const cached = this.cache.get(username);
        if (cached && cached.expiresAt > now) {
            return cached.ename;
        }

        const url = `${this.forgejoApiUrl}/api/v1/users/${encodeURIComponent(username)}`;
        const res = await this.fetchImpl(url, {
            headers: { Authorization: `token ${this.adminToken}` },
        });

        if (res.status === 404) {
            // The account no longer exists. Evicted rather than cached: unlike
            // the stable "this account has no linked eVault" fact cached below,
            // a 404 isn't something to keep trusting for an hour - and treating
            // it as a transient failure to retry would be wrong too, since a
            // deleted account isn't coming back.
            this.cache.delete(username);
            return null;
        }

        if (!res.ok) {
            throw new Error(
                `GET /api/v1/users/${username} failed: HTTP ${res.status}`,
            );
        }

        const body = (await res.json()) as { login_name?: string };
        const ename = enameFromLoginName(body.login_name ?? "");

        this.cache.set(username, { ename, expiresAt: now + this.ttlMs });
        return ename;
    }
}
