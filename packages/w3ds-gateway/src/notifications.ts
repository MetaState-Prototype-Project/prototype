/**
 * W3DS Gateway — Notification Helpers
 *
 * Utility functions for embedding gateway links in notification messages.
 * Platforms use these in NotificationService classes to create messages
 * whose links open the embeddable `<w3ds-gateway-chooser>` modal.
 *
 * The generated links use a `w3ds-gateway:` custom protocol that platform
 * frontends intercept. When a message renderer encounters a link with
 * `href="w3ds-gateway://resolve?ename=...&schemaId=...&entityId=..."`,
 * it opens the web component chooser instead of navigating.
 *
 * For platforms that haven't integrated the interceptor yet, an optional
 * fallback URL can be provided — the `data-fallback-href` attribute carries
 * it alongside the gateway protocol.
 */

import { SchemaLabels } from "./schemas.js";
import type { SchemaId } from "./schemas.js";

export interface GatewayLinkOptions {
    /** The eName of the entity owner */
    ename: string;
    /** The ontology schema ID of the content */
    schemaId: string;
    /** The entity ID of the specific resource */
    entityId?: string;
    /** Custom link text (defaults to a label derived from the schema) */
    linkText?: string;
    /** Optional fallback URL for platforms that haven't integrated the interceptor */
    fallbackUrl?: string;
}

/**
 * Structured gateway link data that platforms can use to open the chooser.
 *
 * This is framework-agnostic — platforms can serialize it as JSON in a
 * message payload, or convert it to the `w3ds-gateway:` protocol link.
 */
export interface GatewayLinkData {
    ename: string;
    schemaId: string;
    entityId?: string;
    label: string;
    /** The `w3ds-gateway://resolve?...` URI */
    gatewayUri: string;
}

/**
 * Build a `w3ds-gateway://resolve?...` URI that encodes the eName, schemaId,
 * and entityId. Platform frontends intercept this protocol to open the
 * `<w3ds-gateway-chooser>` web component.
 *
 * @example
 * ```ts
 * buildGatewayUri({ ename: "@user-uuid", schemaId: SchemaIds.File, entityId: "file-1" })
 * // → "w3ds-gateway://resolve?ename=%40user-uuid&schemaId=a1b...&entityId=file-1"
 * ```
 */
export function buildGatewayUri(options: Pick<GatewayLinkOptions, "ename" | "schemaId" | "entityId">): string {
    const params = new URLSearchParams({
        ename: options.ename,
        schemaId: options.schemaId,
    });
    if (options.entityId) {
        params.set("entityId", options.entityId);
    }
    return `w3ds-gateway://resolve?${params.toString()}`;
}

/**
 * Build structured gateway link data. Useful for platforms that want to
 * store gateway metadata as JSON instead of raw HTML.
 *
 * @example
 * ```ts
 * const data = buildGatewayData({
 *   ename: "@user-uuid",
 *   schemaId: SchemaIds.File,
 *   entityId: "file-1",
 * });
 * // → { ename: "...", schemaId: "...", entityId: "file-1",
 * //     label: "Open File", gatewayUri: "w3ds-gateway://resolve?..." }
 * ```
 */
export function buildGatewayData(options: GatewayLinkOptions): GatewayLinkData {
    const label =
        options.linkText ??
        `Open ${SchemaLabels[options.schemaId as SchemaId] ?? "content"}`;
    return {
        ename: options.ename,
        schemaId: options.schemaId,
        entityId: options.entityId,
        label,
        gatewayUri: buildGatewayUri(options),
    };
}

/**
 * Build an HTML anchor that uses the `w3ds-gateway:` protocol.
 *
 * Platform message renderers should intercept clicks on links whose
 * `href` starts with `w3ds-gateway://` and open the
 * `<w3ds-gateway-chooser>` web component instead of navigating.
 *
 * If a `fallbackUrl` is provided, it's placed in a `data-fallback-href`
 * attribute so non-integrated renderers can still navigate somewhere useful.
 *
 * @example
 * ```ts
 * const html = buildGatewayLink({
 *   ename: "@user-uuid",
 *   schemaId: SchemaIds.SignatureContainer,
 *   entityId: "container-123",
 *   linkText: "View the signed document",
 * });
 * // → '<a href="w3ds-gateway://resolve?ename=..." class="w3ds-gateway-link"
 * //      data-ename="@user-uuid" data-schema-id="..."
 * //      data-entity-id="container-123">View the signed document</a>'
 * ```
 */
export function buildGatewayLink(options: GatewayLinkOptions): string {
    const uri = buildGatewayUri(options);
    const label =
        options.linkText ??
        `Open ${SchemaLabels[options.schemaId as SchemaId] ?? "content"}`;

    const attrs: string[] = [
        `href="${escapeAttr(uri)}"`,
        `class="w3ds-gateway-link"`,
        `data-ename="${escapeAttr(options.ename)}"`,
        `data-schema-id="${escapeAttr(options.schemaId)}"`,
    ];

    if (options.entityId) {
        attrs.push(`data-entity-id="${escapeAttr(options.entityId)}"`);
    }

    if (options.fallbackUrl) {
        attrs.push(`data-fallback-href="${escapeAttr(options.fallbackUrl)}"`);
    }

    return `<a ${attrs.join(" ")}>${escapeHtml(label)}</a>`;
}


// ─── Internal helpers ───────────────────────────────────────────────────────

function escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
