/**
 * The connector's own step in the login: turning a wallet's signed session
 * into an approved session, and an approved session into a one-time code for
 * the browser that started it.
 */

import type { AppDeps } from "./app.js";
import { withQuery } from "./http/errors.js";
import { log } from "./log.js";

const MAX_FIELD_LENGTH = 1024;

export type WalletLoginOutcome =
    | "approved"
    | "invalid_request"
    | "unknown_session"
    | "expired"
    | "not_pending"
    | "invalid_signature";

export interface WalletLoginInput {
    eName?: unknown;
    session?: unknown;
    signature?: unknown;
}

function field(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value !== "" &&
        value.length <= MAX_FIELD_LENGTH
    );
}

/**
 * Verifies the wallet's signature over session S and approves S. A failed
 * verification leaves the session pending so the user can try again.
 */
export async function completeWalletLogin(
    deps: AppDeps,
    input: WalletLoginInput,
): Promise<WalletLoginOutcome> {
    const { eName, session: sessionId, signature } = input;
    if (!field(eName) || !field(sessionId) || !field(signature)) {
        return "invalid_request";
    }
    const lookup = deps.sessions.lookup(sessionId, deps.now());
    if (lookup.state === "unknown") return "unknown_session";
    if (lookup.state === "expired") return "expired";
    if (lookup.session.status !== "pending") return "not_pending";

    const result = await deps.verifier({
        eName,
        payload: sessionId,
        signature,
    });
    if (!result.valid || !result.eName) {
        log.info(`wallet signature rejected: ${result.error ?? "invalid"}`);
        deps.bus.emit(sessionId, "attempt_failed");
        return "invalid_signature";
    }

    const now = deps.now();
    const approved = deps.sessions.approve(
        sessionId,
        {
            eName: result.eName,
            amr: [result.keyType === "hardware" ? "hwk" : "swk"],
            authTime: Math.floor(now / 1000),
        },
        now,
    );
    if (!approved) {
        // Expired or approved by a concurrent callback while verifying.
        const after = deps.sessions.lookup(sessionId, now);
        return after.state === "live" ? "not_pending" : "expired";
    }
    deps.bus.emit(sessionId, "approved");
    return "approved";
}

/**
 * Consumes an approved session for the browser holding `browserSecret` and
 * returns the client redirect carrying a fresh one-time code. Returns
 * undefined for any other browser, or once the code has been handed out.
 */
export function collectCode(
    deps: AppDeps,
    sessionId: string,
    browserSecret: string | undefined,
): string | undefined {
    const now = deps.now();
    const session = deps.sessions.claim(sessionId, browserSecret, now);
    if (!session?.identity) return undefined;
    const code = deps.codes.issue(
        {
            clientId: session.clientId,
            redirectUri: session.redirectUri,
            state: session.state,
            nonce: session.nonce,
            codeChallenge: session.codeChallenge,
            scope: session.scope,
            identity: session.identity,
        },
        now,
    );
    return withQuery(session.redirectUri, {
        code,
        state: session.state,
        iss: deps.config.issuer,
    });
}
