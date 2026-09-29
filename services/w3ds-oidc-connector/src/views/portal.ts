/**
 * The developer portal's pages. Deliberately provider-neutral: anything
 * specific to one identity provider belongs in the documentation, which every
 * page links to.
 */

import type { ClientRecord } from "../client-store.js";
import type { PortalSession } from "../http/portal-auth.js";
import { escapeHtml, page } from "./page.js";

/** What every portal page needs to render its shell. */
export interface PortalContext {
    nonce: string;
    session: PortalSession;
    /** Base URL of the connector's documentation. */
    docsUrl: string;
}

export interface Crumb {
    label: string;
    href?: string;
}

/**
 * Copies `data-copy` values to the clipboard. The async clipboard API only
 * exists in secure contexts, so plain-http deployments (such as a LAN test)
 * fall back to a hidden textarea and execCommand.
 */
const COPY_SCRIPT = `
(function () {
    function fallback(text) {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        document.body.removeChild(area);
        return ok;
    }
    function done(button, ok) {
        button.textContent = ok ? "Copied" : "Press Ctrl+C";
        if (ok) button.classList.add("copied");
        if (!ok) {
            var code = button.parentNode.querySelector("code");
            var range = document.createRange();
            range.selectNodeContents(code);
            var selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
        setTimeout(function () {
            button.textContent = "Copy";
            button.classList.remove("copied");
        }, 1600);
    }
    document.addEventListener("click", function (event) {
        var button = event.target.closest("[data-copy]");
        if (!button) return;
        var text = button.getAttribute("data-copy");
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(
                function () { done(button, true); },
                function () { done(button, fallback(text)); }
            );
        } else {
            done(button, fallback(text));
        }
    });
})();
`;

/** The hidden field every portal form carries. */
export function csrfField(session: PortalSession): string {
    return `<input type="hidden" name="csrf" value="${escapeHtml(session.csrf)}">`;
}

/** A value with a copy button. `field` names it for tests and styling. */
export function copyField(
    value: string,
    options: { label: string; field: string; secret?: boolean },
): string {
    const safe = escapeHtml(value);
    return `<div class="copy${options.secret ? " secret" : ""}"><code data-field="${options.field}">${safe}</code><button type="button" data-copy="${safe}" aria-label="Copy ${escapeHtml(options.label)}">Copy</button></div>`;
}

function date(value: Date | null): string {
    return value
        ? `${escapeHtml(value.toISOString().slice(0, 16).replace("T", " "))} UTC`
        : "Never";
}

/** A compact date for tables, with the full time on hover. */
function shortDate(value: Date | null): string {
    return value
        ? `<span title="${date(value)}">${escapeHtml(value.toISOString().slice(0, 10))}</span>`
        : "Never";
}

function clientPath(client: Pick<ClientRecord, "clientId">): string {
    return `/portal/clients/${encodeURIComponent(client.clientId)}`;
}

function guidesUrl(docsUrl: string): string {
    return `${docsUrl}/OIDC-Provider-Guides`;
}

function errorCallout(errors: string[]): string {
    if (errors.length === 0) return "";
    return `<div class="callout error" role="alert"><ul>${errors
        .map((error) => `<li>${escapeHtml(error)}</li>`)
        .join("")}</ul></div>`;
}

function noticeCallout(notice: string | undefined): string {
    return notice
        ? `<div class="callout ok" role="status"><p>${escapeHtml(notice)}</p></div>`
        : "";
}

/**
 * The portal shell: top bar, breadcrumbs and page header above `body`.
 * `description` and `actions` are trusted HTML; callers escape user values.
 */
export function portalPage(
    ctx: PortalContext,
    options: {
        title: string;
        crumbs: Crumb[];
        description?: string;
        actions?: string;
        body: string;
    },
): string {
    const crumbs = options.crumbs
        .map((crumb, index) => {
            const label = escapeHtml(crumb.label);
            const last = index === options.crumbs.length - 1;
            return crumb.href && !last
                ? `<li><a href="${crumb.href}">${label}</a></li>`
                : `<li${last ? ' aria-current="page"' : ""}>${label}</li>`;
        })
        .join("");
    return page({
        title: `${options.title} · W3DS OIDC`,
        nonce: ctx.nonce,
        layout: "app",
        referrer: "same-origin",
        script: COPY_SCRIPT,
        body: `<header class="topbar"><div class="topbar-inner">
<a class="brand" href="/portal"><img class="brand-mark" src="/logo.png" alt=""><span>W3DS OIDC</span><span class="brand-sub">Developer portal</span></a>
<nav class="topbar-nav"><a class="active" href="/portal">Clients</a><a href="${escapeHtml(ctx.docsUrl)}/OIDC-Connector" target="_blank" rel="noopener">Docs</a></nav>
<div class="user"><span class="user-name mono" title="${escapeHtml(ctx.session.owner)}">${escapeHtml(ctx.session.owner)}</span>
<form method="post" action="/portal/logout">${csrfField(ctx.session)}<button class="secondary" type="submit">Sign out</button></form></div>
</div></header>
<div class="container">
<nav aria-label="Breadcrumb"><ol class="crumbs">${crumbs}</ol></nav>
<div class="page-header"><div><h1>${escapeHtml(options.title)}</h1>${options.description ? `<p>${options.description}</p>` : ""}</div>${options.actions ? `<div class="page-actions">${options.actions}</div>` : ""}</div>
${options.body}
</div>`,
    });
}

const CLIENTS: Crumb = { label: "Clients", href: "/portal" };

export function portalHomePage(
    ctx: PortalContext,
    options: { clients: ClientRecord[]; notice?: string },
): string {
    const rows = options.clients
        .map(
            (client) => `<tr>
<td class="name"><a href="${clientPath(client)}">${clientAvatar(client)}<span>${escapeHtml(client.name)}</span></a></td>
<td>${copyField(client.clientId, { label: "client ID", field: "client-id" })}</td>
<td class="num">${client.redirectUris.length}</td>
<td>${client.syntheticEmail ? '<span class="badge accent">Always email</span>' : '<span class="badge">Standard</span>'}</td>
<td class="nowrap">${shortDate(client.createdAt)}</td>
<td class="nowrap">${shortDate(client.lastUsedAt)}</td>
</tr>`,
        )
        .join("\n");
    const body =
        options.clients.length === 0
            ? `<div class="panel"><div class="empty">
<h2>You have no clients yet</h2>
<p>A client lets one identity provider offer "Log in with W3DS" to its users.</p>
<a class="button" href="/portal/clients/new">Create your first client</a>
</div></div>`
            : `<div class="panel"><div class="table-wrap"><table>
<thead><tr><th>Name</th><th>Client ID</th><th class="num">Redirect URIs</th><th>Claims</th><th>Created</th><th>Last used</th></tr></thead>
<tbody>
${rows}
</tbody></table></div></div>`;
    return portalPage(ctx, {
        title: "Clients",
        crumbs: [{ label: "Clients" }],
        description:
            'Each client is an identity provider that offers "Log in with W3DS".',
        actions:
            options.clients.length > 0
                ? '<a class="button" href="/portal/clients/new">New client</a>'
                : undefined,
        body: `${noticeCallout(options.notice)}${body}`,
    });
}

export interface ClientFormValues {
    name: string;
    redirectUris: string;
    syntheticEmail: boolean;
    logoUrl: string;
}

/** The client's logo, or its initial on a tinted square when it has none. */
function clientAvatar(client: Pick<ClientRecord, "name" | "logoUrl">, size: "sm" | "lg" = "sm"): string {
    if (client.logoUrl) {
        return `<img class="avatar ${size}" src="${escapeHtml(client.logoUrl)}" alt="" referrerpolicy="no-referrer">`;
    }
    const initial = escapeHtml((client.name.trim()[0] ?? "?").toUpperCase());
    return `<span class="avatar ${size} initial" aria-hidden="true">${initial}</span>`;
}

function clientFields(ctx: PortalContext, values: ClientFormValues): string {
    return `<div class="form-row">
<label for="name">Name</label>
<input type="text" id="name" name="name" maxlength="64" required value="${escapeHtml(values.name)}">
<p class="hint">Shown to users on the W3DS login page and in their eID wallet, e.g. your organisation or product.</p>
</div>
<div class="form-row">
<label for="logo_url">Logo URL <span class="hint">(optional)</span></label>
<input type="text" id="logo_url" name="logo_url" inputmode="url" spellcheck="false" placeholder="https://example.com/logo.png" value="${escapeHtml(values.logoUrl)}">
<p class="hint">A square image (PNG, JPEG, WebP or SVG, at least 128×128) shown on the W3DS login page and in the eID wallet. Must use https.</p>
</div>
<div class="form-row">
<label for="redirect_uris">Redirect URIs</label>
<textarea id="redirect_uris" name="redirect_uris" required spellcheck="false" placeholder="https://idp.example.com/callback">${escapeHtml(values.redirectUris)}</textarea>
<p class="hint">One per line, up to 10. Use the callback (redirect) URL your identity provider shows when you add an OpenID Connect provider; it is matched exactly. Must use https (http only on localhost). <a href="${escapeHtml(guidesUrl(ctx.docsUrl))}" target="_blank" rel="noopener">Where to find it for popular providers</a></p>
</div>
<div class="form-row">
<label class="check"><input type="checkbox" name="synthetic_email"${values.syntheticEmail ? " checked" : ""}>
<span><strong>My identity provider requires an email address</strong>
<span class="hint">The user's email from their eVault profile is sent whenever your identity provider requests the <code>email</code> scope. Turn this on if your identity provider refuses users without an email: the claim is then always sent, and users with no email in their profile get <code>&lt;username&gt;@w3ds.invalid</code>, which can never receive mail. Profile emails are self-asserted, so <code>email_verified</code> is always <code>false</code>.</span></span></label>
</div>`;
}

export function newClientPage(
    ctx: PortalContext,
    options: { values: ClientFormValues; errors?: string[] },
): string {
    return portalPage(ctx, {
        title: "New client",
        crumbs: [CLIENTS, { label: "New client" }],
        description: "Register an identity provider that will offer Log in with W3DS.",
        body: `${errorCallout(options.errors ?? [])}
<form method="post" action="/portal/clients" class="panel">
${csrfField(ctx.session)}
<div class="panel-header"><div><h2>Client details</h2></div></div>
<div class="panel-body">${clientFields(ctx, options.values)}</div>
<div class="panel-footer"><button type="submit">Create client</button><a class="button secondary" href="/portal">Cancel</a></div>
</form>`,
    });
}

/** Everything an identity provider needs to connect, each value copyable. */
function connectionPanel(issuer: string, client: ClientRecord): string {
    const scope = "openid profile email";
    const copy = (label: string, field: string, value: string) =>
        copyField(value, { label, field });
    const rows: [string, string][] = [
        ["Discovery URL", copy("discovery URL", "discovery-url", `${issuer}/.well-known/openid-configuration`)],
        ["Issuer", copy("issuer", "issuer", issuer)],
        ["Authorization endpoint", copy("authorization endpoint", "authorization-endpoint", `${issuer}/authorize`)],
        ["Token endpoint", copy("token endpoint", "token-endpoint", `${issuer}/token`)],
        ["Userinfo endpoint", copy("userinfo endpoint", "userinfo-endpoint", `${issuer}/userinfo`)],
        ["JWKS URL", copy("JWKS URL", "jwks-url", `${issuer}/jwks`)],
        ["Scopes", copy("scopes", "scopes", scope)],
        [
            "Client authentication",
            "Client secret over HTTP Basic (<code>client_secret_basic</code>) or in the request body (<code>client_secret_post</code>)",
        ],
        ["PKCE", "Required, method <code>S256</code>"],
        ["ID token signing", "<code>ES256</code>"],
        [
            "User identifier",
            "Link accounts on <code>sub</code> (the eName). Apps behind your identity provider get the eName as <code>preferred_username</code>",
        ],
    ];
    return `<section class="panel">
<div class="panel-header"><div><h2>Connection details</h2><p>Most identity providers only need the discovery URL, client ID and client secret.</p></div></div>
<div class="kv">${rows.map(([k, v]) => `<div class="k">${k}</div><div class="v">${v}</div>`).join("")}</div>
</section>`;
}

export function editClientPage(
    ctx: PortalContext,
    options: {
        issuer: string;
        client: ClientRecord;
        values: ClientFormValues;
        errors?: string[];
        notice?: string;
    },
): string {
    const { client } = options;
    return portalPage(ctx, {
        title: client.name,
        crumbs: [CLIENTS, { label: client.name }],
        description: `Created ${date(client.createdAt)} · last used ${date(client.lastUsedAt)}`,
        body: `${noticeCallout(options.notice)}
<section class="panel">
<div class="panel-header"><div><h2>Credentials</h2></div></div>
<div class="kv">
<div class="k">Client ID</div><div class="v">${copyField(client.clientId, { label: "client ID", field: "client-id" })}</div>
<div class="k">Client secret</div><div class="v"><p>Hidden. It was shown once when created; rotate it below to get a new one.</p></div>
<div class="k">Secret last rotated</div><div class="v">${date(client.secretRotatedAt)}</div>
<div class="k">Logo</div><div class="v">${client.logoUrl ? `<div class="logo-row">${clientAvatar(client, "lg")}${copyField(client.logoUrl, { label: "logo URL", field: "logo-url" })}</div>` : "<p>None. Add one in the settings below.</p>"}</div>
<div class="k">Redirect URIs</div><div class="v">${client.redirectUris
            .map((uri) => copyField(uri, { label: "redirect URI", field: "redirect-uri" }))
            .join("")}</div>
</div>
</section>
${connectionPanel(options.issuer, client)}
${errorCallout(options.errors ?? [])}
<form method="post" action="${clientPath(client)}" class="panel">
${csrfField(ctx.session)}
<div class="panel-header"><div><h2>Settings</h2></div></div>
<div class="panel-body">${clientFields(ctx, options.values)}</div>
<div class="panel-footer"><button type="submit">Save changes</button></div>
</form>
<section class="panel">
<div class="panel-header"><div><h2>Rotate client secret</h2><p>Issues a new secret. The current one stops working immediately.</p></div>
<form method="post" action="${clientPath(client)}/rotate">${csrfField(ctx.session)}<button class="secondary" type="submit">Rotate secret…</button></form></div>
</section>
<section class="panel danger">
<div class="panel-header"><div><h2>Delete client</h2><p>Users of this identity provider will no longer be able to log in with W3DS.</p></div>
<form method="post" action="${clientPath(client)}/delete">${csrfField(ctx.session)}<button class="danger" type="submit">Delete client…</button></form></div>
</section>`,
    });
}

export function confirmPage(
    ctx: PortalContext,
    options: { client: ClientRecord; action: "rotate" | "delete" },
): string {
    const { client, action } = options;
    const copy =
        action === "rotate"
            ? {
                  crumb: "Rotate secret",
                  title: "Rotate the client secret?",
                  body: "The current secret stops working immediately. Logins through your identity provider fail until you paste the new secret into it.",
                  button: "Rotate secret",
                  style: "",
                  panel: "panel",
              }
            : {
                  crumb: "Delete",
                  title: "Delete this client?",
                  body: "This can't be undone. Users of this identity provider will no longer be able to log in with W3DS. Accounts your identity provider already created are not affected.",
                  button: "Delete client",
                  style: ' class="danger"',
                  panel: "panel danger",
              };
    return portalPage(ctx, {
        title: copy.title,
        crumbs: [
            CLIENTS,
            { label: client.name, href: clientPath(client) },
            { label: copy.crumb },
        ],
        body: `<form method="post" action="${clientPath(client)}/${action}" class="${copy.panel}">
${csrfField(ctx.session)}
<input type="hidden" name="confirm" value="yes">
<div class="panel-body">
<p><strong>${escapeHtml(client.name)}</strong></p>
${copyField(client.clientId, { label: "client ID", field: "client-id" })}
<p>${copy.body}</p>
</div>
<div class="panel-footer"><button${copy.style} type="submit">${copy.button}</button><a class="button secondary" href="${clientPath(client)}">Cancel</a></div>
</form>`,
    });
}

/** Shown once, right after a client is created or its secret rotated. */
export function credentialsPage(
    ctx: PortalContext,
    options: {
        client: ClientRecord;
        secret: string;
        issuer: string;
        rotated: boolean;
    },
): string {
    const { client } = options;
    const title = options.rotated ? "New client secret" : "Client created";
    return portalPage(ctx, {
        title,
        crumbs: [
            CLIENTS,
            { label: client.name, href: clientPath(client) },
            { label: "Credentials" },
        ],
        description: escapeHtml(client.name),
        actions: `<a class="button" href="${clientPath(client)}">Done</a>`,
        body: `<div class="callout warn" role="alert"><p><strong>Copy the client secret now.</strong> It is shown only once and stored only as a hash. If you lose it, rotate it.</p></div>
<section class="panel">
<div class="panel-header"><div><h2>Credentials</h2></div></div>
<div class="kv">
<div class="k">Client ID</div><div class="v">${copyField(client.clientId, { label: "client ID", field: "client-id" })}</div>
<div class="k">Client secret</div><div class="v">${copyField(options.secret, { label: "client secret", field: "client-secret", secret: true })}</div>
</div>
</section>
${connectionPanel(options.issuer, client)}
<section class="panel">
<div class="panel-header"><div><h2>Next steps</h2></div></div>
<div class="panel-body">
<ol class="steps">
<li>In your identity provider, add an <strong>OpenID Connect</strong> provider. It may be called an external, upstream, social or federated identity provider.</li>
<li>Give it the <strong>discovery URL</strong> above. If it can't discover settings, fill in the issuer and endpoints by hand.</li>
<li>Enter the <strong>client ID</strong> and <strong>client secret</strong>, and choose client secret authentication (HTTP Basic).</li>
<li>Turn on <strong>PKCE</strong> with method <code>S256</code>, and request the scopes above.</li>
<li>Make sure its callback URL is one of this client's redirect URIs, then try logging in.</li>
</ol>
<p>Step-by-step guides for popular identity providers are in the <a href="${escapeHtml(guidesUrl(ctx.docsUrl))}" target="_blank" rel="noopener">documentation</a>.</p>
</div>
</section>`,
    });
}
