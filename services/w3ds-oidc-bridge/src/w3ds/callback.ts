import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import type { BridgeContext } from "../context.js";
import { renderErrorPage } from "../oidc/pages.js";
import { isWalletVersionAtLeast } from "./wallet-version.js";

/** 256 bits of CSPRNG, url-safe. The code is a bearer credential for 60 seconds. */
function mintCode(): string {
    return randomBytes(32).toString("base64url");
}

type WalletLogin =
    | { ok: true; redirect: string }
    | { ok: false; status: number; error: string; message: string };

/**
 * Verifies a wallet's signed session and mints the authorization code.
 *
 * Every failure is also pushed into the SSE stream. The browser is sitting in
 * front of a QR code on possibly another device; the wallet reported the
 * problem to us, and this is the only channel back.
 */
async function completeWalletLogin(
    ctx: BridgeContext,
    field: (name: string) => string | undefined,
): Promise<WalletLogin> {
    const ename = field("ename") ?? field("w3id");
    const session = field("session");
    const signature = field("signature");

    if (!session) {
        return {
            ok: false,
            status: 400,
            error: "session is required",
            message: "The wallet did not send a sign-in request.",
        };
    }

    const reject = (
        status: number,
        error: string,
        message: string,
    ): WalletLogin => {
        ctx.streams.publish(session, { type: "error", message });
        return { ok: false, status, error, message };
    };

    if (!ename) {
        return reject(
            400,
            "ename is required",
            "The wallet did not send an identity.",
        );
    }
    if (!signature) {
        return reject(
            400,
            "signature is required",
            "The wallet did not send a signature.",
        );
    }

    if (
        !isWalletVersionAtLeast(
            field("appVersion"),
            ctx.config.minWalletVersion,
        )
    ) {
        return reject(
            400,
            "App version too old",
            `Your eID Wallet is out of date. Update to ${ctx.config.minWalletVersion} or later and try again.`,
        );
    }

    const pending = ctx.store.sessions.take(session);
    if (!pending) {
        return reject(
            400,
            "unknown or expired session",
            "This sign-in request has expired. Go back to GitW3 and start again.",
        );
    }

    const verification = await ctx.verifyLogin({
        ename,
        session,
        signature,
    });
    if (!verification.valid) {
        return reject(
            401,
            "Invalid signature",
            "Your wallet's signature could not be verified. Please try again.",
        );
    }

    const code = mintCode();
    ctx.store.codes.set(code, {
        clientId: pending.clientId,
        redirectUri: pending.redirectUri,
        codeChallenge: pending.codeChallenge,
        nonce: pending.nonce,
        ename,
    });

    const redirect = new URL(pending.redirectUri);
    redirect.searchParams.set("code", code);
    if (pending.state) redirect.searchParams.set("state", pending.state);

    ctx.streams.publish(session, {
        type: "redirect",
        url: redirect.toString(),
    });
    return { ok: true, redirect: redirect.toString() };
}

function stringField(source: Record<string, unknown>) {
    return (name: string): string | undefined =>
        typeof source[name] === "string" && source[name]
            ? (source[name] as string)
            : undefined;
}

/** Where the wallet POSTs after the person approves (QR code flow). */
export function createCallbackHandler(ctx: BridgeContext): RequestHandler {
    return async (req, res) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const result = await completeWalletLogin(ctx, stringField(body));
        if (!result.ok) {
            res.status(result.status).json({
                error: result.error,
                message: result.message,
            });
            return;
        }
        res.status(200).json({ ok: true });
    };
}

/**
 * Where the wallet sends the phone's browser when sign-in started on the same
 * phone. The wallet builds this URL as `new URL("/deeplink-login", redirect)`,
 * so it lives at the origin root whatever path the bridge is mounted under.
 *
 * On success the browser goes straight to the client's callback with the
 * code. The waiting login page is told too, which covers a wallet that opened
 * a different browser from the one the sign-in started in.
 */
export function createDeeplinkHandler(ctx: BridgeContext): RequestHandler {
    return async (req, res) => {
        const query = req.query as Record<string, unknown>;
        const result = await completeWalletLogin(ctx, stringField(query));
        res.set("Cache-Control", "no-store");
        res.set("Referrer-Policy", "no-referrer");
        if (!result.ok) {
            res.status(result.status)
                .type("html")
                .send(renderErrorPage("Sign-in failed", result.message));
            return;
        }
        res.redirect(303, result.redirect);
    };
}

export function createEventsHandler(ctx: BridgeContext): RequestHandler {
    return (req, res) => {
        const session = req.params.session;
        if (!session) {
            res.status(400).end();
            return;
        }

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store",
            Connection: "keep-alive",
            // nginx buffers text/event-stream by default, which turns a live
            // stream into one that delivers everything at the end.
            "X-Accel-Buffering": "no",
        });
        res.flushHeaders?.();

        ctx.streams.subscribe(session, res);
    };
}
