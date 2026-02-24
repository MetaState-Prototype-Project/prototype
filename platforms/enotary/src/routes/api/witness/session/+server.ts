import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { witnessService } from "$lib/server/witness";
import { env as publicEnv } from "$env/dynamic/public";

export const POST: RequestHandler = async ({ request, url }) => {
    try {
        const { targetEName, witnessEName } = (await request.json()) as {
            targetEName?: string;
            witnessEName?: string;
        };
        if (!targetEName || !witnessEName) {
            return json(
                { error: "targetEName and witnessEName are required" },
                { status: 400 },
            );
        }

        const callbackBaseUrl = publicEnv.PUBLIC_ENOTARY_URL || url.origin;

        const { session, qrData } = witnessService.createWitnessSession({
            targetEName,
            expectedWitnessEName: witnessEName,
            requestOrigin: callbackBaseUrl,
        });
        return json({ session, qrData });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Failed to create witness session";
        return json({ error: message }, { status: 500 });
    }
};
