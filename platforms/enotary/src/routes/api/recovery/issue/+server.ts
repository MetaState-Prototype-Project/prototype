import { env } from "$env/dynamic/private";
import { error, json } from "@sveltejs/kit";
import { evaultService } from "$lib/server/evault";
import { signRecoveryToken } from "$lib/server/jwt";
import {
    RECOVERY_TTL_MS,
    createSession,
} from "$lib/server/recoverySessions";

/**
 * Notary-side endpoint: mint a one-shot recovery code for the given eName.
 *
 * Request: { targetEName: string }
 * Response: { sessionId, expiresAt, token, qrPayload }
 *
 * The notary's own identity comes from server env (ENOTARY_ENAME +
 * ENOTARY_PUBLIC_URL), not from the client — the client only declares whom
 * the code is FOR. The signed JWT in qrPayload is what the wallet verifies
 * against this notary's /.well-known/jwks.json before trusting the code.
 */
export async function POST({ request }) {
    const body = (await request.json().catch(() => null)) as {
        targetEName?: unknown;
    } | null;
    if (!body || typeof body.targetEName !== "string" || !body.targetEName.trim()) {
        throw error(400, "targetEName is required");
    }

    const notaryEName = env.ENOTARY_ENAME;
    if (!notaryEName) {
        throw error(500, "ENOTARY_ENAME is not configured on this notary host");
    }
    const publicUrl = env.ENOTARY_PUBLIC_URL;
    if (!publicUrl) {
        throw error(
            500,
            "ENOTARY_PUBLIC_URL is not configured (must match the registry's whitelist entry url)",
        );
    }

    const targetEName = evaultService.normalizeEName(body.targetEName.trim());

    // Resolve the vault now so we can fail fast if the eName doesn't exist,
    // and so the claim endpoint can return the URI without an extra lookup.
    let vaultUri: string;
    try {
        vaultUri = await evaultService.resolveEVaultUrl(targetEName);
    } catch (err) {
        console.warn("[recovery/issue] eName resolve failed:", err);
        throw error(404, "Could not resolve that eName in the registry");
    }

    const session = createSession({
        targetEName,
        notaryEName,
        vaultUri,
    });

    const claim = new URL("/api/recovery/claim", publicUrl).toString();
    const ttlSeconds = Math.floor(RECOVERY_TTL_MS / 1000);
    const token = await signRecoveryToken(
        {
            sessionId: session.sessionId,
            targetEName,
            notaryEName,
            claim,
        },
        ttlSeconds,
    );

    const qrPayload = `w3ds://notary-recovery?token=${encodeURIComponent(token)}`;

    return json({
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
        token,
        qrPayload,
    });
}
