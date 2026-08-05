import { buildAuthOffer } from "@metastate-foundation/auth";
import type { RequestHandler } from "express";
import QRCode from "qrcode";
import type { BridgeContext } from "../context.js";
import { renderErrorPage, renderQrPage } from "./pages.js";

/** The name the wallet shows the person when it asks them to approve. */
export const PLATFORM_NAME = "gitw3";

/** Where the wallet POSTs. Ours to choose — it travels inside `redirect`. */
export const CALLBACK_PATH = "/w3ds/callback";

function param(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function createAuthorizeHandler(ctx: BridgeContext): RequestHandler {
    return async (req, res) => {
        const query = req.query as Record<string, unknown>;

        // The client and the callback are validated before anything else, and a
        // failure in either renders a page rather than redirecting. Redirecting an
        // error to an unverified URI is what turns a provider into an open
        // redirector.
        const client = ctx.clients.find(param(query.client_id));
        if (!client) {
            res.status(400)
                .type("html")
                .send(
                    renderErrorPage(
                        "Unknown client",
                        "This bridge does not recognise the client_id in the request. Check the authentication source configured in GitW3.",
                    ),
                );
            return;
        }

        const redirectUri = param(query.redirect_uri);
        if (redirectUri !== client.redirectUri) {
            res.status(400)
                .type("html")
                .send(
                    renderErrorPage(
                        "Unregistered redirect_uri",
                        "The redirect_uri in the request is not the one registered for this client. It is compared exactly, so a trailing slash or a different host is enough to fail.",
                    ),
                );
            return;
        }

        // From here the callback is trusted, so errors go back to it the way the
        // spec expects.
        const state = param(query.state);
        const bounce = (error: string, description: string) => {
            const url = new URL(client.redirectUri);
            url.searchParams.set("error", error);
            url.searchParams.set("error_description", description);
            if (state) url.searchParams.set("state", state);
            res.redirect(url.toString());
        };

        if (param(query.response_type) !== "code") {
            return bounce(
                "unsupported_response_type",
                "Only the code response type is supported",
            );
        }

        const codeChallenge = param(query.code_challenge);
        if (!codeChallenge) {
            // Forgejo sends one for openidConnect providers, so a request without
            // it is either a misconfiguration or not Forgejo.
            return bounce("invalid_request", "code_challenge is required");
        }

        if (param(query.code_challenge_method) !== "S256") {
            return bounce(
                "invalid_request",
                "code_challenge_method must be S256",
            );
        }

        const offer = buildAuthOffer({
            baseUrl: ctx.config.publicUrl,
            platform: PLATFORM_NAME,
            callbackPath: CALLBACK_PATH,
        });

        ctx.store.sessions.set(offer.session, {
            clientId: client.clientId,
            redirectUri: client.redirectUri,
            state,
            nonce: param(query.nonce),
            codeChallenge,
        });

        const qrDataUri = await QRCode.toDataURL(offer.uri, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 480,
        });

        res.type("html")
            // A session id is a credential for the next five minutes.
            .set("Cache-Control", "no-store")
            .send(
                renderQrPage({
                    walletUri: offer.uri,
                    qrDataUri,
                    eventsUrl: `${ctx.config.publicUrl}/w3ds/events/${encodeURIComponent(offer.session)}`,
                }),
            );
    };
}
