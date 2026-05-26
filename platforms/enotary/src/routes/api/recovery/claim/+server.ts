import { error, json } from "@sveltejs/kit";
import { evaultService } from "$lib/server/evault";
import { writeRecoveryAudit } from "$lib/server/recoveryAudit";
import { consumeSession } from "$lib/server/recoverySessions";

/**
 * Wallet-side endpoint: claim a previously-issued recovery code.
 *
 * Request: { sessionId, targetEName }
 * Response: { success, eName?, uri?, reason? }
 *
 * Open (no bearer): the cryptographic gate happened wallet-side via JWT
 * verification against this notary's JWKS. By the time the wallet hits this
 * endpoint, it has already proven the QR was minted here. We just need to
 * confirm the session is still valid + flip it to consumed.
 */
export async function POST({ request }) {
    const body = (await request.json().catch(() => null)) as {
        sessionId?: unknown;
        targetEName?: unknown;
    } | null;
    if (
        !body ||
        typeof body.sessionId !== "string" ||
        typeof body.targetEName !== "string"
    ) {
        throw error(400, "sessionId and targetEName are required");
    }

    const targetEName = evaultService.normalizeEName(body.targetEName.trim());
    const result = consumeSession({ sessionId: body.sessionId, targetEName });

    if (!result.ok) {
        return json({ success: false, reason: result.reason });
    }

    // Fire-and-forget audit. If it fails the wallet has still recovered; the
    // audit is observability, not security.
    void writeRecoveryAudit({
        targetEName: result.session.targetEName,
        notaryEName: result.session.notaryEName,
        sessionId: result.session.sessionId,
        issuedAt: result.session.issuedAt,
        claimedAt: result.session.consumedAt ?? Date.now(),
    }).catch((err) => {
        console.warn("[recovery/claim] audit write failed:", err);
    });

    return json({
        success: true,
        eName: result.session.targetEName,
        uri: result.session.vaultUri,
    });
}
