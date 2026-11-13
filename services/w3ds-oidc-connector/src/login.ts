/**
 * The connector's own step in the login: turning a wallet's signed session
 * into an approved session, and an approved session into a one-time code for
 * the browser that started it.
 */

import { normalizeEName } from "@metastate-foundation/auth/ename";
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

    // Read the profile while the signature is checked; it is used only if
    // the signature proves this same eName.
    const { purpose } = lookup.session;
    const wantsProfile =
        purpose.kind === "oidc" &&
        purpose.request.scope.some((s) => s === "email" || s === "profile");
    const claimedEName = normalizeEName(eName);
    const [result, profile] = await Promise.all([
        deps.verifier({ eName, payload: sessionId, signature }),
        wantsProfile ? deps.profiles(claimedEName) : undefined,
    ]);
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
            ...(profile && result.eName === claimedEName && { profile }),
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

/** Where a browser finishes a developer portal login. */
export function portalCompletionPath(sessionId: string): string {
    return `/portal/login/complete?session=${encodeURIComponent(sessionId)}`;
}

/**
 * Where the browser holding `browserSecret` goes once the wallet has
 * signed, or undefined for any other browser or once it has been used.
 *
 * For an IdP login this consumes the session and returns the IdP redirect
 * carrying a fresh one-time code. For a portal login it returns the portal
 * completion URL without consuming anything: that request can set the
 * portal cookie, which an event stream already under way cannot.
 */
export function collectCode(
    deps: AppDeps,
    sessionId: string,
    browserSecret: string | undefined,
): string | undefined {
    const now = deps.now();
    const lookup = deps.sessions.lookup(sessionId, now);
    if (lookup.state === "live" && lookup.session.purpose.kind === "portal") {
        const { session } = lookup;
        return session.status === "approved" &&
            deps.sessions.isBrowser(session, browserSecret)
            ? portalCompletionPath(sessionId)
            : undefined;
    }
    const session = deps.sessions.claim(sessionId, browserSecret, now);
    if (!session?.identity || session.purpose.kind !== "oidc") return undefined;
    const { request } = session.purpose;
    const code = deps.codes.issue({ ...request, identity: session.identity }, now);
    return withQuery(request.redirectUri, {
        code,
        state: request.state,
        iss: deps.config.issuer,
    });
}
