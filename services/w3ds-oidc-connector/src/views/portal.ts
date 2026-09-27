import type { ClientRecord } from "../client-store.js";
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

function date(value: Date | null): string {
    return value ? escapeHtml(value.toISOString().slice(0, 16).replace("T", " ")) + " UTC" : "never";
}

function clientPath(client: Pick<ClientRecord, "clientId">): string {
    return `/portal/clients/${encodeURIComponent(client.clientId)}`;
}

function errorList(errors: string[]): string {
    if (errors.length === 0) return "";
    return `<ul class="errors" role="alert">${errors
        .map((error) => `<li>${escapeHtml(error)}</li>`)
        .join("")}</ul>`;
}

export function portalHomePage(options: {
    nonce: string;
    session: PortalSession;
    clients: ClientRecord[];
    notice?: string;
}): string {
    const list =
        options.clients.length === 0
            ? `<div class="card"><p>You have no clients yet. A client lets one identity provider, such as a Keycloak realm or a Rauthy instance, offer "Log in with W3DS".</p></div>`
            : options.clients
                  .map(
                      (client) => `<div class="card">
<h3><a href="${clientPath(client)}">${escapeHtml(client.name)}</a></h3>
<p class="meta">Client ID <span class="mono">${escapeHtml(client.clientId)}</span></p>
<p class="meta">${client.redirectUris.length} redirect URI${client.redirectUris.length === 1 ? "" : "s"} · created ${date(client.createdAt)} · last used ${date(client.lastUsedAt)}</p>
</div>`,
                  )
                  .join("\n");
    return portalPage({
        ...options,
        title: "Your clients",
        body: `<h1>Your clients</h1>
<p>Each client is an identity provider that can log users in with their W3DS eName.</p>
${options.notice ? `<p class="status ok" role="status">${escapeHtml(options.notice)}</p>` : ""}
<div class="actions"><a class="button" href="/portal/clients/new">New client</a></div>
${list}`,
    });
}

export interface ClientFormValues {
    name: string;
    redirectUris: string;
    syntheticEmail: boolean;
}

function clientFields(values: ClientFormValues): string {
    return `<label for="name">Name</label>
<input type="text" id="name" name="name" maxlength="64" required value="${escapeHtml(values.name)}">
<p class="hint">Shown to users on the W3DS login page, e.g. your organisation or app.</p>

<label for="redirect_uris">Redirect URIs</label>
<textarea id="redirect_uris" name="redirect_uris" required spellcheck="false">${escapeHtml(values.redirectUris)}</textarea>
<p class="hint">One per line, up to 10. Use your IdP's callback, for example
<span class="mono">https://keycloak.example.com/realms/&lt;realm&gt;/broker/w3ds/endpoint</span> or
<span class="mono">https://rauthy.example.com/auth/v1/providers/callback</span>. Must be https (http only on localhost).</p>

<label class="check"><input type="checkbox" name="synthetic_email"${values.syntheticEmail ? " checked" : ""}>
<span>My identity provider requires an email address (e.g. Rauthy)
<span class="hint">Adds <span class="mono">&lt;user&gt;@w3ds.invalid</span> with <span class="mono">email_verified: false</span>. The address can never receive mail.</span></span></label>`;
}

export function newClientPage(options: {
    nonce: string;
    session: PortalSession;
    values: ClientFormValues;
    errors?: string[];
}): string {
    return portalPage({
        ...options,
        title: "New client",
        body: `<h1>New client</h1>
${errorList(options.errors ?? [])}
<form method="post" action="/portal/clients">
${csrfField(options.session)}
${clientFields(options.values)}
<div class="actions"><button type="submit">Create client</button><a class="button secondary" href="/portal">Cancel</a></div>
</form>`,
    });
}

export function editClientPage(options: {
    nonce: string;
    session: PortalSession;
    client: ClientRecord;
    values: ClientFormValues;
    errors?: string[];
    notice?: string;
}): string {
    const { client, session } = options;
    return portalPage({
        ...options,
        title: client.name,
        body: `<h1>${escapeHtml(client.name)}</h1>
${options.notice ? `<p class="status ok" role="status">${escapeHtml(options.notice)}</p>` : ""}
<dl class="fields">
<dt>Client ID</dt><dd class="mono">${escapeHtml(client.clientId)}</dd>
<dt>Client secret</dt><dd>Hidden. Rotate it below if you've lost it.</dd>
<dt>Created</dt><dd>${date(client.createdAt)}</dd>
<dt>Secret last rotated</dt><dd>${date(client.secretRotatedAt)}</dd>
<dt>Last used</dt><dd>${date(client.lastUsedAt)}</dd>
</dl>

<h2>Settings</h2>
${errorList(options.errors ?? [])}
<form method="post" action="${clientPath(client)}">
${csrfField(session)}
${clientFields(options.values)}
<div class="actions"><button type="submit">Save changes</button></div>
</form>

<h2>Client secret</h2>
<p>Rotating issues a new secret and stops the current one working immediately. Update your identity provider straight away.</p>
<form method="post" action="${clientPath(client)}/rotate">${csrfField(session)}<button class="secondary" type="submit">Rotate secret…</button></form>

<h2>Delete</h2>
<p>Users of this identity provider will no longer be able to log in with W3DS.</p>
<form method="post" action="${clientPath(client)}/delete">${csrfField(session)}<button class="danger" type="submit">Delete client…</button></form>`,
    });
}

export function confirmPage(options: {
    nonce: string;
    session: PortalSession;
    client: ClientRecord;
    action: "rotate" | "delete";
}): string {
    const { client, session, action } = options;
    const copy =
        action === "rotate"
            ? {
                  title: "Rotate the client secret?",
                  body: "The current secret stops working immediately. Logins through your identity provider fail until you paste the new secret into it.",
                  button: "Rotate secret",
                  style: "",
              }
            : {
                  title: "Delete this client?",
                  body: "This can't be undone. Users of this identity provider will no longer be able to log in with W3DS.",
                  button: "Delete client",
                  style: ' class="danger"',
              };
    return portalPage({
        ...options,
        title: copy.title,
        body: `<h1>${copy.title}</h1>
<p><strong>${escapeHtml(client.name)}</strong> · <span class="mono">${escapeHtml(client.clientId)}</span></p>
<p>${copy.body}</p>
<form method="post" action="${clientPath(client)}/${action}">
${csrfField(session)}
<input type="hidden" name="confirm" value="yes">
<div class="actions"><button${copy.style} type="submit">${copy.button}</button><a class="button secondary" href="${clientPath(client)}">Cancel</a></div>
</form>`,
    });
}

/** Shown once, right after a client is created or its secret rotated. */
export function credentialsPage(options: {
    nonce: string;
    session: PortalSession;
    client: ClientRecord;
    secret: string;
    issuer: string;
    rotated: boolean;
}): string {
    const { client, issuer } = options;
    const discovery = `${issuer}/.well-known/openid-configuration`;
    const scope = client.syntheticEmail ? "openid profile email" : "openid profile";
    return portalPage({
        ...options,
        title: options.rotated ? "New client secret" : "Client created",
        body: `<h1>${options.rotated ? "New client secret" : "Client created"}</h1>
<div class="secret">
<p><strong>Copy the client secret now.</strong> It is shown only once. If you lose it, rotate it.</p>
<dl class="fields">
<dt>Client ID</dt><dd class="mono">${escapeHtml(client.clientId)}</dd>
<dt>Client secret</dt><dd class="mono">${escapeHtml(options.secret)}</dd>
</dl>
</div>

<h2>Connect your identity provider</h2>
<dl class="fields">
<dt>Discovery URL</dt><dd class="mono">${escapeHtml(discovery)}</dd>
<dt>Issuer</dt><dd class="mono">${escapeHtml(issuer)}</dd>
<dt>Client authentication</dt><dd>Client secret sent as HTTP Basic (<span class="mono">client_secret_basic</span>); <span class="mono">client_secret_post</span> also works</dd>
<dt>PKCE</dt><dd>Required, method S256</dd>
<dt>Scopes</dt><dd class="mono">${scope}</dd>
<dt>Redirect URIs</dt><dd class="mono">${client.redirectUris.map(escapeHtml).join("<br>")}</dd>
</dl>
<p><strong>Keycloak:</strong> add an <em>OpenID Connect v1.0</em> identity provider with the discovery URL above, turn on <em>Validate signatures</em>, <em>Use JWKS URL</em> and <em>PKCE (S256)</em>, and map <span class="mono">preferred_username</span> to the username.</p>
<p><strong>Rauthy:</strong> add an upstream provider, enter the issuer and click <em>Lookup</em>, tick <span class="mono">client_secret_basic</span>, then enable <em>Auto-Onboarding</em> on the provider.</p>
<div class="actions"><a class="button" href="${clientPath(client)}">Done</a></div>`,
    });
}

export function landingPage(options: {
    nonce: string;
    issuer: string;
    platformName: string;
}): string {
    const discovery = `${options.issuer}/.well-known/openid-configuration`;
    return page({
        title: options.platformName,
        nonce: options.nonce,
        wide: true,
        body: `<h1>${escapeHtml(options.platformName)}</h1>
<p>An OpenID Connect provider whose login is a W3DS eID wallet signature. Add it to Keycloak, Rauthy or any OIDC identity provider as an upstream provider, and your users can log in with their eName.</p>
<dl class="fields">
<dt>Discovery URL</dt><dd class="mono">${escapeHtml(discovery)}</dd>
</dl>
<div class="actions"><a class="button" href="/portal">Developer portal</a></div>`,
    });
}
