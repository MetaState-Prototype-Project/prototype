import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { witnessService } from "$lib/server/witness";

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { sessionId, signature, w3id, message } = (await request.json()) as {
            sessionId?: string;
            signature?: string;
            w3id?: string;
            message?: string;
        };

        if (!sessionId || !signature || !w3id || !message) {
            return json(
                { error: "sessionId, signature, w3id and message are required" },
                { status: 400 },
            );
        }

        const session = await witnessService.verifyWitnessCallback({
            sessionId,
            signature,
            w3id,
            message,
        });

        return json({ success: true, session });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Witness callback failed";
        return json({ success: false, error: message }, { status: 400 });
    }
};
