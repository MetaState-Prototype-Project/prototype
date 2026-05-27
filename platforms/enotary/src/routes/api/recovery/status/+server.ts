import { error, json } from "@sveltejs/kit";
import { getSession } from "$lib/server/recoverySessions";

/**
 * Polling endpoint used by the notary's UI to flip "Waiting for scan…" to
 * "Code scanned ✓" once the wallet consumes the session. Cheap in-process map
 * lookup.
 */
export async function GET({ url }) {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) throw error(400, "sessionId is required");

    const session = getSession(sessionId);
    if (!session) {
        return json({ status: "expired" });
    }
    if (session.status === "pending" && session.expiresAt < Date.now()) {
        return json({ status: "expired" });
    }
    return json({ status: session.status });
}
