import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { witnessService } from "$lib/server/witness";

export const GET: RequestHandler = ({ params }) => {
    const session = witnessService.getSession(params.sessionId);
    if (!session) {
        return json({ error: "Session not found" }, { status: 404 });
    }
    return json({ session });
};
