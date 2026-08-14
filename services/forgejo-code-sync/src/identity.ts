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
