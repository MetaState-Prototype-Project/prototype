import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import type { BridgeContext } from "../context.js";
import { isWalletVersionAtLeast } from "./wallet-version.js";

/** 256 bits of CSPRNG, url-safe. The code is a bearer credential for 60 seconds. */
function mintCode(): string {
    return randomBytes(32).toString("base64url");
}

/**
 * Where the wallet POSTs after the person approves.
 *
 * Every failure past this point is also pushed into the SSE stream. The browser
 * is sitting in front of a QR code on possibly another device; the wallet
 * reported the problem to us, and this is the only channel back.
 */
export function createCallbackHandler(ctx: BridgeContext): RequestHandler {
    return async (req, res) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const field = (name: string): string | undefined =>
            typeof body[name] === "string" && body[name]
                ? (body[name] as string)
                : undefined;

        // The protocol documentation says `w3id`; every platform controller reads
        // `ename`. Accept both, the way awareness-service does.
        const ename = field("ename") ?? field("w3id");
        const session = field("session");
        const signature = field("signature");

        // Without a session id there is nobody to tell, so this one is HTTP only.
        if (!session) {
            res.status(400).json({ error: "session is required" });
            return;
        }

        const reject = (status: number, error: string, message: string) => {
            ctx.streams.publish(session, { type: "error", message });
            res.status(status).json({ error, message });
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

        // Consumed here, so a replayed signature finds no session to attach to.
        const pending = ctx.store.sessions.take(session);
        if (!pending) {
            return reject(
                400,
                "unknown or expired session",
                "This sign-in request has expired. Go back to GitW3 and start again.",
            );
        }

        // The trust anchor: the wallet signed the session id, and the Registry
        // holds the key that proves who signed it.
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
        res.status(200).json({ ok: true });
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
