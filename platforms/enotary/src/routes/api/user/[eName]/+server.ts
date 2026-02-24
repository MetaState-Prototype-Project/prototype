import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { evaultService } from "$lib/server/evault";

export const GET: RequestHandler = async ({ params }) => {
    try {
        const result = await evaultService.fetchBindingDocuments(params.eName);
        return json(result);
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Failed to fetch binding documents";
        return json({ error: message }, { status: 500 });
    }
};
