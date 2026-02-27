/**
 * W3DS Gateway — Embeddable Web Component
 *
 * A self-contained custom element that any platform can embed to show an
 * "Open with..." app chooser for W3DS eNames. Works in any framework
 * (Svelte, React, Vue, plain HTML) via standard Web Component APIs.
 *
 * Usage (HTML):
 *   <script type="module" src="w3ds-gateway/modal"></script>
 *   <w3ds-gateway-chooser
 *     ename="@user-uuid"
 *     schema-id="550e8400-e29b-41d4-a716-446655440001"
 *     entity-id="post-123"
 *     registry-url="https://registry.w3ds.metastate.foundation"
 *   ></w3ds-gateway-chooser>
 *
 * Usage (JS):
 *   import 'w3ds-gateway/modal';
 *   const el = document.createElement('w3ds-gateway-chooser');
 *   el.setAttribute('ename', '@user-uuid');
 *   el.setAttribute('schema-id', '550e8400-...');
 *   el.setAttribute('entity-id', 'post-123');
 *   document.body.appendChild(el);
 *   el.open();
 *
 * Usage (React):
 *   import 'w3ds-gateway/modal';
 *   <w3ds-gateway-chooser ename="..." schema-id="..." entity-id="..." ref={ref} />
 *   ref.current.open();
 *
 * Usage (Svelte):
 *   import 'w3ds-gateway/modal';
 *   <w3ds-gateway-chooser ename="..." schema-id="..." entity-id="..." bind:this={el} />
 *   el.open();
 */

import {
    PLATFORM_CAPABILITIES,
    getPlatformUrls,
    REGISTRY_PLATFORM_KEY_ORDER,
} from "./capabilities.js";
import { SchemaLabels } from "./schemas.js";
import { PLATFORM_ICONS, FALLBACK_ICON } from "./icons.js";
import { isSafeUrl } from "./utils.js";
import type { ResolvedApp } from "./types.js";
import type { SchemaId } from "./schemas.js";

const PLATFORM_COLORS: Record<string, { bg: string; hover: string; border: string }> = {
    pictique:         { bg: "#fdf2f8", hover: "#fce7f3", border: "#fbcfe8" },
    blabsy:           { bg: "#eff6ff", hover: "#dbeafe", border: "#bfdbfe" },
    "file-manager":   { bg: "#eff6ff", hover: "#dbeafe", border: "#bfdbfe" },
    esigner:          { bg: "#eff6ff", hover: "#dbeafe", border: "#bfdbfe" },
    evoting:          { bg: "#fef2f2", hover: "#fee2e2", border: "#fecaca" },
    dreamsync:        { bg: "#eef2ff", hover: "#e0e7ff", border: "#c7d2fe" },
    ecurrency:        { bg: "#ecfeff", hover: "#cffafe", border: "#a5f3fc" },
    ereputation:      { bg: "#fff7ed", hover: "#ffedd5", border: "#fed7aa" },
    cerberus:         { bg: "#fef2f2", hover: "#fee2e2", border: "#fecaca" },
    "group-charter":  { bg: "#fff7ed", hover: "#ffedd5", border: "#fed7aa" },
    emover:           { bg: "#ecfeff", hover: "#cffafe", border: "#a5f3fc" },
};

// ─── Resolver (inline, no external API needed) ─────────────────────────────

async function fetchRegistryPlatforms(
    registryUrl: string,
): Promise<Record<string, string>> {
    try {
        const response = await fetch(`${registryUrl}/platforms`);
        if (!response.ok) return {};
        const urls: (string | null)[] = await response.json();

        const result: Record<string, string> = {};
        for (let i = 0; i < REGISTRY_PLATFORM_KEY_ORDER.length && i < urls.length; i++) {
            if (urls[i]) result[REGISTRY_PLATFORM_KEY_ORDER[i]] = urls[i]!;
        }
        return result;
    } catch {
        return {};
    }
}

function buildUrl(template: string, baseUrl: string, entityId: string, ename: string): string {
    return template
        .replace("{baseUrl}", baseUrl.replace(/\/+$/, ""))
        .replace("{entityId}", encodeURIComponent(entityId))
        .replace("{ename}", encodeURIComponent(ename));
}

async function resolve(
    ename: string,
    schemaId: string,
    entityId: string,
    registryUrl?: string,
    platformUrlOverrides?: Record<string, string>,
): Promise<{ schemaLabel: string; apps: ResolvedApp[] }> {
    let platformUrls: Record<string, string> = { ...getPlatformUrls() };

    if (registryUrl) {
        const registryUrls = await fetchRegistryPlatforms(registryUrl);
        platformUrls = { ...platformUrls, ...registryUrls };
    }

    if (platformUrlOverrides) {
        platformUrls = { ...platformUrls, ...platformUrlOverrides };
    }

    const handlers = PLATFORM_CAPABILITIES[schemaId] ?? [];

    const apps: ResolvedApp[] = handlers
        .filter((h) => platformUrls[h.platformKey])
        .map((h) => ({
            platformName: h.platformName,
            platformKey: h.platformKey,
            url: buildUrl(h.urlTemplate, platformUrls[h.platformKey], entityId, ename),
            label: h.label,
            icon: h.icon,
        }));

    const schemaLabel = SchemaLabels[schemaId as SchemaId] ?? "Unknown content type";

    return { schemaLabel, apps };
}

// ─── Styles (shadow DOM) ────────────────────────────────────────────────────

const STYLES = `
:host {
    display: contents;
}

.gateway-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
}

.gateway-backdrop.open {
    opacity: 1;
    pointer-events: auto;
}

.gateway-modal {
    width: 100%;
    max-width: 420px;
    margin: 0 16px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    overflow: hidden;
    transform: scale(0.95) translateY(10px);
    transition: transform 0.2s ease;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.gateway-backdrop.open .gateway-modal {
    transform: scale(1) translateY(0);
}

.gateway-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid #f3f4f6;
}

.gateway-header-text h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    line-height: 1.4;
}

.gateway-header-text p {
    margin: 2px 0 0;
    font-size: 13px;
    color: #6b7280;
}

.gateway-close {
    background: none;
    border: none;
    padding: 6px;
    border-radius: 8px;
    cursor: pointer;
    color: #9ca3af;
    transition: background 0.15s, color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.gateway-close:hover {
    background: #f3f4f6;
    color: #4b5563;
}

.gateway-close svg {
    width: 20px;
    height: 20px;
}

.gateway-body {
    padding: 16px 24px;
}

.gateway-apps {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.gateway-app-link {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    text-decoration: none;
    transition: background 0.15s, border-color 0.15s;
    cursor: pointer;
}

.gateway-app-link:hover {
    border-color: transparent;
}

.gateway-app-icon {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

.gateway-app-icon svg {
    width: 100%;
    height: 100%;
    display: block;
}

.gateway-app-info {
    flex: 1;
    min-width: 0;
}

.gateway-app-name {
    font-size: 15px;
    font-weight: 500;
    color: #111827;
    margin: 0;
}

.gateway-app-label {
    font-size: 13px;
    color: #6b7280;
    margin: 2px 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.gateway-arrow {
    flex-shrink: 0;
    color: #9ca3af;
}

.gateway-arrow svg {
    width: 18px;
    height: 18px;
}

.gateway-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 0;
    gap: 12px;
    color: #6b7280;
    font-size: 14px;
}

.gateway-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: gateway-spin 0.6s linear infinite;
}

@keyframes gateway-spin {
    to { transform: rotate(360deg); }
}

.gateway-error {
    background: #fef2f2;
    color: #991b1b;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
}

.gateway-error strong {
    display: block;
    margin-bottom: 4px;
}

.gateway-empty {
    text-align: center;
    padding: 32px 0;
    color: #6b7280;
    font-size: 14px;
}

.gateway-empty-icon {
    font-size: 36px;
    margin-bottom: 8px;
}

.gateway-footer {
    border-top: 1px solid #f3f4f6;
    padding: 10px 24px;
    text-align: center;
}

.gateway-footer-ename {
    font-size: 12px;
    color: #9ca3af;
}

.gateway-footer-ename code {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 11px;
}
`;

// ─── Web Component ──────────────────────────────────────────────────────────

const CLOSE_SVG = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
const ARROW_SVG = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>`;

// Use a safe base class. In non-browser environments (Node.js, SSR), HTMLElement
// doesn't exist — we substitute a no-op class so the module can be imported
// without throwing. The real custom element only registers when `customElements`
// is available (i.e. in a browser).

const SafeHTMLElement =
    typeof HTMLElement !== "undefined"
        ? HTMLElement
        : (class {} as unknown as typeof HTMLElement);

export class W3dsGatewayChooser extends SafeHTMLElement {
    private shadow: ShadowRoot;
    private backdrop!: HTMLDivElement;
    private headerText!: HTMLDivElement;
    private body!: HTMLDivElement;
    private footer!: HTMLDivElement;
    private _isOpen = false;
    private _resolveRunId = 0;

    static get observedAttributes() {
        return ["ename", "schema-id", "entity-id", "registry-url", "open"];
    }

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
        if (!this.backdrop) this.render();
        if (this.hasAttribute("open")) {
            this.open();
        }
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (oldValue === newValue) return;
        if (name === "open") {
            if (newValue !== null) {
                this.open();
            } else {
                this.close();
            }
        } else if (this._isOpen) {
            // Re-resolve when attributes change while open
            this.doResolve();
        }
    }

    // ── Public API ──

    /** Open the chooser modal */
    open() {
        this._isOpen = true;
        if (!this.backdrop) this.render();
        this.backdrop.classList.add("open");
        this.doResolve();
        this.dispatchEvent(new CustomEvent("gateway-open"));
    }

    /** Close the chooser modal */
    close() {
        this._isOpen = false;
        this._resolveRunId++; // invalidate any in-flight resolve
        if (this.backdrop) {
            this.backdrop.classList.remove("open");
        }
        this.dispatchEvent(new CustomEvent("gateway-close"));
    }

    /** Check if the modal is currently open */
    get isOpen(): boolean {
        return this._isOpen;
    }

    // ── Internal ──

    private get ename(): string {
        return this.getAttribute("ename") ?? "";
    }

    private get schemaId(): string {
        return this.getAttribute("schema-id") ?? "";
    }

    private get entityId(): string {
        return this.getAttribute("entity-id") ?? "";
    }

    private get registryUrl(): string | undefined {
        return this.getAttribute("registry-url") ?? undefined;
    }

    private render() {
        if (this.backdrop) return;
        const style = document.createElement("style");
        style.textContent = STYLES;

        this.backdrop = document.createElement("div");
        this.backdrop.className = "gateway-backdrop";
        this.backdrop.addEventListener("click", (e) => {
            if (e.target === this.backdrop) this.close();
        });
        this.backdrop.addEventListener("keydown", (e) => {
            if (e.key === "Escape") this.close();
        });

        const modal = document.createElement("div");
        modal.className = "gateway-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", "Open with application");

        // Header
        const header = document.createElement("div");
        header.className = "gateway-header";

        this.headerText = document.createElement("div");
        this.headerText.className = "gateway-header-text";
        this.headerText.innerHTML = `<h2>Open with...</h2>`;

        const closeBtn = document.createElement("button");
        closeBtn.className = "gateway-close";
        closeBtn.setAttribute("aria-label", "Close");
        closeBtn.innerHTML = CLOSE_SVG;
        closeBtn.addEventListener("click", () => this.close());

        header.appendChild(this.headerText);
        header.appendChild(closeBtn);

        // Body
        this.body = document.createElement("div");
        this.body.className = "gateway-body";

        // Footer
        this.footer = document.createElement("div");
        this.footer.className = "gateway-footer";

        modal.appendChild(header);
        modal.appendChild(this.body);
        modal.appendChild(this.footer);
        this.backdrop.appendChild(modal);

        this.shadow.appendChild(style);
        this.shadow.appendChild(this.backdrop);
    }

    private async doResolve() {
        const runId = ++this._resolveRunId;
        const { ename, schemaId, entityId, registryUrl } = this;

        if (!ename || !schemaId) {
            this.body.innerHTML = `<div class="gateway-error"><strong>Missing data</strong>eName and schema-id attributes are required.</div>`;
            this.footer.innerHTML = "";
            return;
        }

        // Loading state
        this.body.innerHTML = `<div class="gateway-loading"><div class="gateway-spinner"></div><span>Resolving applications...</span></div>`;
        this.footer.innerHTML = "";

        try {
            const result = await resolve(ename, schemaId, entityId, registryUrl);

            if (runId !== this._resolveRunId || !this._isOpen) return;

            // Update header subtitle
            this.headerText.innerHTML = `<h2>Open with...</h2><p>${this.escapeHtml(result.schemaLabel)}</p>`;

            if (result.apps.length === 0) {
                this.body.innerHTML = `<div class="gateway-empty"><div class="gateway-empty-icon">🤷</div><p>No applications can handle this content type.</p></div>`;
                this.footer.innerHTML = "";
                return;
            }

            // Render app list
            const container = document.createElement("div");
            container.className = "gateway-apps";

            for (const app of result.apps) {
                const link = document.createElement("a");
                link.className = "gateway-app-link";

                // Only allow http/https URLs — reject javascript:, data:, etc.
                const safeHref = isSafeUrl(app.url) ? app.url : null;
                if (safeHref) {
                    link.href = safeHref;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                } else {
                    link.setAttribute("role", "button");
                    link.setAttribute("aria-disabled", "true");
                    link.style.opacity = "0.4";
                    link.style.cursor = "not-allowed";
                    link.style.pointerEvents = "none";
                }

                const colors = PLATFORM_COLORS[app.platformKey] ?? { bg: "#f9fafb", hover: "#f3f4f6", border: "#e5e7eb" };
                link.style.backgroundColor = colors.bg;
                link.style.borderColor = colors.border;
                link.addEventListener("mouseenter", () => { link.style.backgroundColor = colors.hover; });
                link.addEventListener("mouseleave", () => { link.style.backgroundColor = colors.bg; });

                const icon = PLATFORM_ICONS[app.platformKey] ?? FALLBACK_ICON;

                link.innerHTML = `
                    <span class="gateway-app-icon">${icon}</span>
                    <div class="gateway-app-info">
                        <p class="gateway-app-name">${this.escapeHtml(app.platformName)}</p>
                        <p class="gateway-app-label">${this.escapeHtml(app.label)}</p>
                    </div>
                    <span class="gateway-arrow">${ARROW_SVG}</span>
                `;

                link.addEventListener("click", () => {
                    this.dispatchEvent(new CustomEvent("gateway-select", {
                        detail: { platformKey: app.platformKey, url: app.url },
                    }));
                });

                container.appendChild(link);
            }

            this.body.innerHTML = "";
            this.body.appendChild(container);

            // Footer
            this.footer.innerHTML = `<span class="gateway-footer-ename">eName: <code>${this.escapeHtml(ename)}</code></span>`;
        } catch (err) {
            if (runId !== this._resolveRunId || !this._isOpen) return;
            const msg = err instanceof Error ? err.message : "Unknown error";
            this.body.innerHTML = `<div class="gateway-error"><strong>Resolution failed</strong>${this.escapeHtml(msg)}</div>`;
            this.footer.innerHTML = "";
        }
    }

    private escapeHtml(str: string): string {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }
}

// Register the custom element
if (typeof customElements !== "undefined" && !customElements.get("w3ds-gateway-chooser")) {
    customElements.define("w3ds-gateway-chooser", W3dsGatewayChooser);
}
