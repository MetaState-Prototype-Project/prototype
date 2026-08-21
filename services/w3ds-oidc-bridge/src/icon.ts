import type { RequestHandler } from "express";

/**
 * The mark on GitW3's "Sign in with W3DS" button.
 *
 * Forgejo renders whatever `IconURL` points at inside an `<img width=28>`
 * (`services/auth/source/oauth2/providers.go:62`), so it is served from the
 * bridge itself: the browser can always reach it, since it is about to be sent
 * to the same origin for `/authorize`, and it can never fall out of step with
 * the service that owns it.
 *
 * Inlined as a string rather than kept as an asset file because the build is
 * `tsc` alone — a file in `assets/` would not reach `dist/`, and the icon would
 * quietly 404 in the container.
 *
 * The shield-and-key is the same vocabulary as the Nextcloud W3DS login plugin,
 * so anyone who has seen that button recognises this one. Restyled to the
 * MetaState purple and to the house convention: 162 viewBox, 32 corner radius,
 * 9 stroke, white on brand.
 */
export const W3DS_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 162 162" width="162" height="162" fill="none">' +
    '<rect width="162" height="162" rx="32" fill="#8968FF"/>' +
    '<g stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M81 34 L116 51 V85 C116 108 101 124 81 130 C61 124 46 108 46 85 V51 Z"/>' +
    '<circle cx="81" cy="72" r="13"/>' +
    '<path d="M81 85 V107"/>' +
    '<path d="M81 99 H93"/>' +
    "</g></svg>";

export function createIconHandler(): RequestHandler {
    return (_req, res) => {
        res.type("image/svg+xml")
            // Immutable in practice: a change to the mark ships as a new release.
            .set("Cache-Control", "public, max-age=86400")
            .send(W3DS_ICON_SVG);
    };
}

/**
 * The same mark as a 180x180 PNG, served at `/apple-touch-icon.png`.
 *
 * This one is for the eID Wallet rather than for a browser. When the wallet
 * shows its approval screen it resolves the app icon from the *hostname* of the
 * redirect URI — which is the bridge — and not from the `platform` query
 * parameter (`PlatformAppCard.svelte`, via `getPlatformKey`). Its cascade runs:
 * an icon bundled in `@metastate-foundation/platform-icons`, then
 * `/apple-touch-icon.png` on that host, then `/favicon.ico`, then a single
 * letter on a coloured square. Serving the second rung is what keeps GitW3 from
 * appearing as a bare letter, and unlike adding an icon to the shared package it
 * needs no wallet release to take effect.
 *
 * Full bleed, no corner radius. The wallet clips it to its own `rounded-2xl` and
 * iOS applies its own mask, so rounding it here would only show through as
 * transparent notches inside a slightly different radius.
 *
 * Base64 for the same reason the SVG above is inlined: the build is `tsc` alone,
 * so a file under `assets/` would never reach `dist/`. It is a rasterisation of
 * that SVG minus the `rx` — regenerate the two together.
 */
const TOUCH_ICON_BASE64 =
    "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" +
    "AAAAAElFTkSuQmCC";

const W3DS_TOUCH_ICON_PNG = Buffer.from(TOUCH_ICON_BASE64, "base64");

export function createTouchIconHandler(): RequestHandler {
    return (_req, res) => {
        res.type("image/png")
            .set("Cache-Control", "public, max-age=86400")
            .send(W3DS_TOUCH_ICON_PNG);
    };
}
