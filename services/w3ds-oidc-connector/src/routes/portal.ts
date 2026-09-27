import express, { type Request, type Response, Router } from "express";
import QRCode from "qrcode";
import type { AppDeps } from "../app.js";
import type { ClientRecord } from "../client-store.js";
import {
    type ClientInput,
    generateClientId,
    generateClientSecret,
    hashClientSecret,
    validateClientInput,
} from "../clients.js";
import {
    endPortalSession,
    portalSession,
    readPortalSession,
    requirePortalSession,
    startPortalSession,
} from "../http/portal-auth.js";
import {
    clearBindingCookie,
    htmlSecurityHeaders,
    newBrowserSecret,
    readBindingCookie,
    setBindingCookie,
} from "../http/security.js";
import { authorizePage } from "../views/authorize.js";
import { messagePage } from "../views/messages.js";
import { log } from "../log.js";
import {
    type ClientFormValues,
    confirmPage,
    credentialsPage,
    editClientPage,
    newClientPage,
    portalHomePage,
} from "../views/portal.js";
import { walletLink } from "./authorize.js";

export function portalRouter(deps: AppDeps): Router {
    const router = Router();
    const { config } = deps;
    const secure = config.issuer.startsWith("https:");
    const forms = express.urlencoded({ extended: false, limit: "16kb" });
    const signedIn = requirePortalSession(deps);

    const loginFailed = (res: Response, message: string) => {
        const nonce = htmlSecurityHeaders(res);
        res.status(400).send(
            messagePage({ nonce, title: "Sign-in failed", message, tone: "error" }),
        );
    };

    router.get("/portal/login", async (req, res, next) => {
        try {
            if (await readPortalSession(deps, req)) {
                return res.redirect(303, "/portal");
            }
            const browserSecret = newBrowserSecret();
            const session = deps.sessions.create(
                { kind: "portal" },
                browserSecret,
                deps.now(),
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
            res.send(
                authorizePage({
                    nonce,
                    platformName: config.platformName,
                    heading: "Sign in to the developer portal",
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

    // The login page's event stream sends the browser here once the wallet
    // has signed; only the browser that opened the QR code can complete.
    router.get("/portal/login/complete", async (req, res, next) => {
        try {
            const sessionId = req.query.session;
            if (typeof sessionId !== "string") {
                return loginFailed(res, "This sign-in link is incomplete.");
            }
            const lookup = deps.sessions.lookup(sessionId, deps.now());
            if (lookup.state !== "live" || lookup.session.purpose.kind !== "portal") {
                return loginFailed(res, "This sign-in has expired. Start again.");
            }
            const session = deps.sessions.claim(
                sessionId,
                readBindingCookie(req, sessionId, secure),
                deps.now(),
            );
            if (!session?.identity) {
                return loginFailed(
                    res,
                    "Finish signing in in the browser where you opened the QR code.",
                );
            }
            clearBindingCookie(res, sessionId, secure);
            await startPortalSession(deps, res, session.identity.eName);
            res.redirect(303, "/portal");
        } catch (error) {
            next(error);
        }
    });

    router.post("/portal/logout", forms, signedIn, (_req, res) => {
        endPortalSession(deps, res);
        res.redirect(303, "/portal/login");
    });

    // The bare URL is for people, and the portal is the only page for them.
    router.get("/", (_req, res) => {
        res.redirect(302, "/portal");
    });

    const render = (res: Response, status: number, html: (nonce: string) => string) => {
        const nonce = htmlSecurityHeaders(res, { forms: true });
        res.status(status).send(html(nonce));
    };

    const notFound = (res: Response) => {
        const nonce = htmlSecurityHeaders(res);
        res.status(404).send(
            messagePage({
                nonce,
                title: "Client not found",
                message: "There is no client with that ID in your account.",
                tone: "error",
            }),
        );
    };

    /** Loads the :clientId client, if the signed-in eName owns it. */
    const ownedClient = async (req: Request, res: Response) =>
        deps.clients.repository.findOwned(
            portalSession(res).owner,
            req.params.clientId,
        );

    const formValues = (body: Record<string, unknown>): ClientFormValues => ({
        name: typeof body.name === "string" ? body.name : "",
        redirectUris:
            typeof body.redirect_uris === "string" ? body.redirect_uris : "",
        syntheticEmail: body.synthetic_email === "on",
    });

    const clientValues = (client: ClientRecord): ClientFormValues => ({
        name: client.name,
        redirectUris: client.redirectUris.join("\n"),
        syntheticEmail: client.syntheticEmail,
    });

    const readInput = (body: Record<string, unknown>) =>
        validateClientInput({
            name: body.name,
            redirectUris: body.redirect_uris,
            syntheticEmail: body.synthetic_email,
        });

    router.get("/portal", signedIn, async (req, res, next) => {
        try {
            const session = portalSession(res);
            const clients = await deps.clients.repository.listByOwner(session.owner);
            const notice =
                req.query.deleted === "1" ? "Client deleted." : undefined;
            render(res, 200, (nonce) =>
                portalHomePage({ nonce, session, clients, notice }),
            );
        } catch (error) {
            next(error);
        }
    });

    router.get("/portal/clients/new", signedIn, (_req, res) => {
        render(res, 200, (nonce) =>
            newClientPage({
                nonce,
                session: portalSession(res),
                values: { name: "", redirectUris: "", syntheticEmail: false },
            }),
        );
    });

    router.post("/portal/clients", forms, signedIn, async (req, res, next) => {
        try {
            const session = portalSession(res);
            const body = req.body as Record<string, unknown>;
            const values = formValues(body);
            const since = new Date(deps.now() - 60 * 60 * 1000);
            const recent = await deps.clients.repository.countCreatedSince(
                session.owner,
                since,
            );
            if (recent >= config.clientCreateLimit) {
                return render(res, 429, (nonce) =>
                    newClientPage({
                        nonce,
                        session,
                        values,
                        errors: [
                            `You can create up to ${config.clientCreateLimit} clients an hour. Try again later.`,
                        ],
                    }),
                );
            }
            const input = readInput(body);
            if (!input.ok) {
                return render(res, 400, (nonce) =>
                    newClientPage({ nonce, session, values, errors: input.errors }),
                );
            }
            const secret = generateClientSecret();
            const client = await createClient(deps, session.owner, input.value, secret);
            log.info(`client ${client.clientId} created by ${session.owner}`);
            render(res, 201, (nonce) =>
                credentialsPage({
                    nonce,
                    session,
                    client,
                    secret,
                    issuer: config.issuer,
                    rotated: false,
                }),
            );
        } catch (error) {
            next(error);
        }
    });

    router.get("/portal/clients/:clientId", signedIn, async (req, res, next) => {
        try {
            const client = await ownedClient(req, res);
            if (!client) return notFound(res);
            render(res, 200, (nonce) =>
                editClientPage({
                    nonce,
                    session: portalSession(res),
                    client,
                    values: clientValues(client),
                    notice: req.query.saved === "1" ? "Changes saved." : undefined,
                }),
            );
        } catch (error) {
            next(error);
        }
    });

    router.post("/portal/clients/:clientId", forms, signedIn, async (req, res, next) => {
        try {
            const session = portalSession(res);
            const client = await ownedClient(req, res);
            if (!client) return notFound(res);
            const body = req.body as Record<string, unknown>;
            const input = readInput(body);
            if (!input.ok) {
                return render(res, 400, (nonce) =>
                    editClientPage({
                        nonce,
                        session,
                        client,
                        values: formValues(body),
                        errors: input.errors,
                    }),
                );
            }
            const updated = await deps.clients.repository.update(
                session.owner,
                client.clientId,
                input.value,
            );
            if (!updated) return notFound(res);
            res.redirect(303, `/portal/clients/${encodeURIComponent(client.clientId)}?saved=1`);
        } catch (error) {
            next(error);
        }
    });

    router.post("/portal/clients/:clientId/rotate", forms, signedIn, async (req, res, next) => {
        try {
            const session = portalSession(res);
            const client = await ownedClient(req, res);
            if (!client) return notFound(res);
            if (req.body?.confirm !== "yes") {
                return render(res, 200, (nonce) =>
                    confirmPage({ nonce, session, client, action: "rotate" }),
                );
            }
            const secret = generateClientSecret();
            const rotated = await deps.clients.repository.rotateSecret(
                session.owner,
                client.clientId,
                hashClientSecret(secret),
            );
            if (!rotated) return notFound(res);
            log.info(`client ${client.clientId} secret rotated by ${session.owner}`);
            render(res, 200, (nonce) =>
                credentialsPage({
                    nonce,
                    session,
                    client: rotated,
                    secret,
                    issuer: config.issuer,
                    rotated: true,
                }),
            );
        } catch (error) {
            next(error);
        }
    });

    router.post("/portal/clients/:clientId/delete", forms, signedIn, async (req, res, next) => {
        try {
            const session = portalSession(res);
            const client = await ownedClient(req, res);
            if (!client) return notFound(res);
            if (req.body?.confirm !== "yes") {
                return render(res, 200, (nonce) =>
                    confirmPage({ nonce, session, client, action: "delete" }),
                );
            }
            if (!(await deps.clients.repository.delete(session.owner, client.clientId))) {
                return notFound(res);
            }
            log.info(`client ${client.clientId} deleted by ${session.owner}`);
            res.redirect(303, "/portal?deleted=1");
        } catch (error) {
            next(error);
        }
    });

    return router;
}

/** Creates a client with a fresh ID, retrying once on the unlikely collision. */
async function createClient(
    deps: AppDeps,
    owner: string,
    input: ClientInput,
    secret: string,
): Promise<ClientRecord> {
    const attempt = () =>
        deps.clients.repository.create({
            clientId: generateClientId(),
            secretHash: hashClientSecret(secret),
            ownerEName: owner,
            ...input,
        });
    try {
        return await attempt();
    } catch {
        return attempt();
    }
}
