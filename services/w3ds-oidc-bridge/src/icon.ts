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
