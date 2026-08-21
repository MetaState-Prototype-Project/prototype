import type { RequestHandler } from "express";
import { buildClaims } from "../claims.js";
import type { BridgeContext } from "../context.js";

/**
 * Served for conformance. goth would skip it entirely if the discovery document
 * omitted `userinfo_endpoint` — but since we advertise it, goth calls it and
 * then insists the `sub` here matches the ID token's exactly. Both come from the
 * same eName through the same function, so they cannot drift.
 */
export function createUserinfoHandler(ctx: BridgeContext): RequestHandler {
    return async (req, res) => {
        const header = req.header("authorization");
        if (!header?.toLowerCase().startsWith("bearer ")) {
            res.status(401)
                .set("WWW-Authenticate", 'Bearer error="invalid_request"')
                .json({
                    error: "invalid_request",
                    error_description: "Missing bearer token",
                });
            return;
        }

        const token = header.slice(7).trim();

        let sub: string;
        try {
            // The access token is a JWT we signed, so this needs no stored state:
            // signature, issuer, audience and expiry are all checked here.
            const payload = await ctx.keyring.verify(token, {
                audience: ctx.config.publicUrl,
            });
            if (typeof payload.sub !== "string" || payload.sub.length === 0) {
                throw new Error("access token carries no subject");
            }
            sub = payload.sub;
        } catch {
            res.status(401)
                .set("WWW-Authenticate", 'Bearer error="invalid_token"')
                .json({
                    error: "invalid_token",
                    error_description: "Bearer token is not valid",
                });
            return;
        }

        const claims = buildClaims(sub, {
            emailDomain: ctx.config.emailDomain,
            extraReservedUsernames: ctx.config.extraReservedUsernames,
        });

        res.set("Cache-Control", "no-store").json(claims);
    };
}
