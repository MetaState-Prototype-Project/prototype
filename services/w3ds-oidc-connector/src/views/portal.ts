import type { PortalSession } from "../http/portal-auth.js";
import { escapeHtml, page } from "./page.js";

/** The hidden field every portal form carries. */
export function csrfField(session: PortalSession): string {
    return `<input type="hidden" name="csrf" value="${escapeHtml(session.csrf)}">`;
}

/** A portal page: the signed-in eName and a sign-out button above `body`. */
export function portalPage(options: {
    nonce: string;
    session: PortalSession;
    title: string;
    body: string;
}): string {
    return page({
        title: `${options.title} · W3DS OIDC`,
        nonce: options.nonce,
        wide: true,
        body: `<div class="bar">
<a href="/portal"><strong>W3DS OIDC developer portal</strong></a>
<span class="who">Signed in as <span class="mono">${escapeHtml(options.session.owner)}</span></span>
<form method="post" action="/portal/logout">${csrfField(options.session)}<button class="secondary" type="submit">Sign out</button></form>
</div>
${options.body}`,
    });
}

export function portalHomePage(options: {
    nonce: string;
    session: PortalSession;
}): string {
    return portalPage({
        ...options,
        title: "Your clients",
        body: "<h1>Your clients</h1>",
    });
}
