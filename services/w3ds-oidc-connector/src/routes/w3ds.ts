import cors from "cors";
import express, { type Request, type Response, Router } from "express";
import type { AppDeps } from "../app.js";
import {
    clearBindingCookie,
    htmlSecurityHeaders,
    readBindingCookie,
} from "../http/security.js";
import {
    type WalletLoginOutcome,
    collectCode,
    completeWalletLogin,
} from "../login.js";
import { messagePage } from "../views/messages.js";

const MAX_STREAMS_PER_SESSION = 3;
const HEARTBEAT_MS = 15_000;

const CALLBACK_STATUS: Record<WalletLoginOutcome, number> = {
    approved: 200,
    invalid_request: 400,
    unknown_session: 404,
    expired: 410,
    not_pending: 409,
    invalid_signature: 401,
};

const DEEPLINK_MESSAGES: Record<
    Exclude<WalletLoginOutcome, "approved">,
    { title: string; message: string }
> = {
    invalid_request: {
        title: "Login failed",
        message: "The wallet sent an incomplete login. Try again from the site.",
    },
    unknown_session: {
        title: "Login not found",
        message: "This login does not exist. Go back to the site and start again.",
    },
    expired: {
        title: "Login expired",
        message: "This login has expired. Go back to the site and start again.",
    },
    not_pending: {
        title: "Already signed in",
        message: "This login was already completed. Return to the tab where you started.",
    },
    invalid_signature: {
        title: "Login failed",
        message: "Your wallet's signature could not be verified. Try again.",
    },
};

/**
 * The wallet names the eName `ename`; the W3DS spec calls it `w3id`. Accept
 * either, but not two different values.
 */
function readEName(source: Record<string, unknown>): unknown {
    const { ename, w3id } = source;
    if (ename !== undefined && w3id !== undefined && ename !== w3id) {
        return undefined;
    }
    return ename ?? w3id;
}

export function w3dsRouter(deps: AppDeps): Router {
    const router = Router();
    const secure = deps.config.issuer.startsWith("https:");

    // The wallet posts from its own webview, so the callback must allow any
    // origin. It carries no cookies and returns nothing secret.
    const walletCors = cors({
        origin: "*",
        methods: ["POST"],
        allowedHeaders: ["Content-Type"],
    });
    router.options("/w3ds/callback", walletCors);
    router.post(
        "/w3ds/callback",
        walletCors,
        express.json({ limit: "16kb" }),
        async (req, res, next) => {
            try {
                const body = (req.body ?? {}) as Record<string, unknown>;
                const outcome = await completeWalletLogin(deps, {
                    eName: readEName(body),
                    session: body.session,
                    signature: body.signature,
                });
                res.setHeader("Cache-Control", "no-store");
                res.status(CALLBACK_STATUS[outcome]).json(
                    outcome === "approved" ? { ok: true } : { error: outcome },
                );
            } catch (error) {
                next(error);
            }
        },
    );

    // On a phone the wallet opens this in the browser instead of posting.
    router.get("/deeplink-login", async (req, res, next) => {
        try {
            const query = req.query as Record<string, unknown>;
            const outcome = await completeWalletLogin(deps, {
                eName: readEName(query),
                session: query.session,
                signature: query.signature,
            });
            const nonce = htmlSecurityHeaders(res);
            if (outcome !== "approved") {
                const { title, message } = DEEPLINK_MESSAGES[outcome];
                res.status(CALLBACK_STATUS[outcome]).send(
                    messagePage({ nonce, title, message, tone: "error" }),
                );
                return;
            }
            const sessionId = query.session as string;
            const redirect = collectCode(
                deps,
                sessionId,
                readBindingCookie(req, sessionId, secure),
            );
            if (redirect) {
                clearBindingCookie(res, sessionId, secure);
                res.redirect(303, redirect);
                return;
            }
            // A different browser from the one that opened the QR page: that
            // tab's event stream will collect the code.
            res.status(200).send(
                messagePage({
                    nonce,
                    title: "Approved",
                    message: "You're signed in. Return to the tab where you started.",
                    tone: "ok",
                }),
            );
        } catch (error) {
            next(error);
        }
    });

    router.get("/w3ds/events/:session", (req, res) => {
        streamSessionEvents(deps, secure, req, res);
    });

    return router;
}

function sendEvent(res: Response, event: string, data: unknown = {}): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function openStream(res: Response): void {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
}

/**
 * Tells the login page when the wallet has signed. The code is delivered here
 * and only here, and only to the browser holding the session's cookie.
 */
function streamSessionEvents(
    deps: AppDeps,
    secure: boolean,
    req: Request,
    res: Response,
): void {
    const sessionId = req.params.session;
    const lookup = deps.sessions.lookup(sessionId, deps.now());
    if (lookup.state !== "live" || lookup.session.status === "delivered") {
        openStream(res);
        sendEvent(res, "expired", {
            reason: lookup.state === "live" ? "used" : "expired",
        });
        res.end();
        return;
    }
    const { session } = lookup;
    const browserSecret = readBindingCookie(req, sessionId, secure);
    if (!deps.sessions.isBrowser(session, browserSecret)) {
        // Not an event stream, so EventSource gives up instead of retrying.
        res.status(403).type("text/plain").send("wrong browser");
        return;
    }
    if (session.streams >= MAX_STREAMS_PER_SESSION) {
        res.status(429).type("text/plain").send("too many streams");
        return;
    }

    openStream(res);
    res.write("retry: 3000\n\n");
    sendEvent(res, "pending");
    session.streams += 1;

    let closed = false;
    let expiryTimer: NodeJS.Timeout | undefined;
    const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
    const unsubscribe = deps.bus.subscribe(sessionId, (event) => {
        if (event === "approved") deliver();
        else sendEvent(res, event);
    });

    const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(expiryTimer);
        unsubscribe();
        session.streams -= 1;
        res.end();
    };

    const deliver = () => {
        if (closed) return;
        const redirect = collectCode(deps, sessionId, browserSecret);
        if (redirect) {
            sendEvent(res, "approved", { redirect });
            close();
        } else if (session.status === "delivered") {
            // Another tab of this browser collected it first.
            sendEvent(res, "expired", { reason: "used" });
            close();
        }
    };

    const scheduleExpiry = () => {
        const delay = Math.max(0, session.expiresAt - deps.now());
        expiryTimer = setTimeout(() => {
            if (deps.sessions.lookup(sessionId, deps.now()).state === "live") {
                // Approval extends the session; wait for the new deadline.
                scheduleExpiry();
                return;
            }
            sendEvent(res, "expired", { reason: "expired" });
            close();
        }, delay + 50);
        expiryTimer.unref();
    };

    req.on("close", close);
    scheduleExpiry();
    // The wallet may have signed before this stream connected.
    deliver();
}
