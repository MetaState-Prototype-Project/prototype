import { type Request, type Response, Router } from "express";
import QRCode from "qrcode";
import type { AppDeps } from "../app.js";
import { redirectError } from "../http/errors.js";
import {
    htmlSecurityHeaders,
    newBrowserSecret,
    setBindingCookie,
} from "../http/security.js";
import { isValidChallenge } from "../pkce.js";
import { authorizePage } from "../views/authorize.js";
import { messagePage } from "../views/messages.js";
import { SUPPORTED_SCOPES } from "./discovery.js";

const MAX_OPAQUE_LENGTH = 512;

/** The `w3ds://auth` link the QR code encodes and the wallet opens. */
export function walletLink(options: {
    issuer: string;
    sessionId: string;
    platformName: string;
}): string {
    const params = new URLSearchParams({
        redirect: `${options.issuer}/w3ds/callback`,
        session: options.sessionId,
        platform: options.platformName,
    });
    return `w3ds://auth?${params}`;
}

type Params = Record<string, string | undefined>;

/**
 * Reads the query as single strings. A repeated parameter arrives as an array
 * and is reported as a duplicate, which OAuth treats as invalid_request.
 */
function readParams(req: Request): { params: Params; duplicates: string[] } {
    const params: Params = {};
    const duplicates: string[] = [];
    for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === "string") params[key] = value;
        else duplicates.push(key);
    }
    return { params, duplicates };
}

export function authorizeRouter(deps: AppDeps): Router {
    const router = Router();
    const { config } = deps;
    const secure = config.issuer.startsWith("https:");

    const errorPage = (res: Response, message: string) => {
        const nonce = htmlSecurityHeaders(res);
        res.status(400).send(
            messagePage({
                nonce,
                title: "This login link is not valid",
                message,
                tone: "error",
            }),
        );
    };

    router.get("/authorize", async (req, res, next) => {
        try {
            const { params, duplicates } = readParams(req);

            // Until client_id and redirect_uri are known good, errors go to
            // the user, never to an unverified redirect target.
            if (duplicates.includes("client_id") || !params.client_id) {
                return errorPage(res, "The request did not identify a client.");
            }
            const client = await deps.clients.get(params.client_id);
            if (!client) {
                return errorPage(res, "The requesting application is not registered.");
            }
            const redirectUri = params.redirect_uri;
            if (
                duplicates.includes("redirect_uri") ||
                !redirectUri ||
                !client.redirectUris.includes(redirectUri)
            ) {
                return errorPage(res, "The redirect address is not registered for this application.");
            }

            const state =
                params.state !== undefined &&
                params.state.length <= MAX_OPAQUE_LENGTH
                    ? params.state
                    : undefined;
            const fail = (error: string, description: string) =>
                redirectError(res, redirectUri, {
                    error,
                    description,
                    state,
                    issuer: config.issuer,
                });

            if (duplicates.length > 0) {
                return fail("invalid_request", `repeated parameter: ${duplicates[0]}`);
            }
            if (params.state !== undefined && state === undefined) {
                return fail("invalid_request", "state is too long");
            }
            if (params.response_type !== "code") {
                return fail("unsupported_response_type", "only response_type=code is supported");
            }
            if (params.response_mode !== undefined && params.response_mode !== "query") {
                return fail("invalid_request", "only response_mode=query is supported");
            }
            if (params.request !== undefined) {
                return fail("request_not_supported", "request objects are not supported");
            }
            if (params.request_uri !== undefined) {
                return fail("request_uri_not_supported", "request_uri is not supported");
            }
            const requested = (params.scope ?? "").split(" ").filter(Boolean);
            if (!requested.includes("openid")) {
                return fail("invalid_scope", "the openid scope is required");
            }
            if (!isValidChallenge(params.code_challenge)) {
                return fail("invalid_request", "a PKCE S256 code_challenge is required");
            }
            if (params.code_challenge_method !== "S256") {
                return fail("invalid_request", "code_challenge_method must be S256");
            }
            if (params.nonce !== undefined && params.nonce.length > MAX_OPAQUE_LENGTH) {
                return fail("invalid_request", "nonce is too long");
            }
            if ((params.prompt ?? "").split(" ").includes("none")) {
                return fail("login_required", "every login needs the wallet");
            }

            const now = deps.now();
            const browserSecret = newBrowserSecret();
            const session = deps.sessions.create(
                {
                    kind: "oidc",
                    request: {
                        clientId: client.clientId,
                        redirectUri,
                        state,
                        nonce: params.nonce,
                        codeChallenge: params.code_challenge,
                        scope: requested.filter((s) =>
                            SUPPORTED_SCOPES.includes(s),
                        ),
                    },
                },
                browserSecret,
                now,
            );
            setBindingCookie(res, session.id, browserSecret, {
                secure,
                maxAgeSeconds: config.sessionTtlSeconds + 120,
            });

            const link = walletLink({
                issuer: config.issuer,
                sessionId: session.id,
                platformName: config.platformName,
            });
            const qrSvg = await QRCode.toString(link, {
                type: "svg",
                errorCorrectionLevel: "M",
                margin: 1,
            });
            const nonce = htmlSecurityHeaders(res);
            res.status(200).send(
                authorizePage({
                    nonce,
                    platformName: config.platformName,
                    clientName: client.name,
                    walletLink: link,
                    qrSvg,
                    eventsUrl: `/w3ds/events/${session.id}`,
                    expiresAt: session.expiresAt,
                }),
            );
        } catch (error) {
            next(error);
        }
    });

    return router;
}
