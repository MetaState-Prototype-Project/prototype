import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { evaultService } from "$lib/server/evault";
import { witnessService } from "$lib/server/witness";

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { targetEName, newPassphrase, witnessSessionIds } =
            (await request.json()) as {
                targetEName?: string;
                newPassphrase?: string;
                witnessSessionIds?: string[];
            };

        if (!targetEName || !newPassphrase) {
            return json(
                { error: "targetEName and newPassphrase are required" },
                { status: 400 },
            );
        }

        const sessionIds = Array.isArray(witnessSessionIds) ? witnessSessionIds : [];
        const witnessed = witnessService.ensureWitnessedSessions(
            targetEName,
            sessionIds,
        );
        await evaultService.setRecoveryPassphrase(targetEName, newPassphrase);

        return json({
            success: true,
            witnessedBy: witnessed.map((session) => session.witnessedBy),
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to reset passphrase";
        return json({ error: message }, { status: 400 });
    }
};
