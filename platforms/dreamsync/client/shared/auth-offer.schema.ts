import { z } from "zod";

export const W3DS_AUTH_URI_PREFIX = "w3ds://auth";

// Response of GET /api/auth/offer; anything else (for example a page served by the client) has no login code to show
export const authOfferResponseSchema = z.object({
    offer: z.string().startsWith(W3DS_AUTH_URI_PREFIX),
    sessionId: z.string().min(1),
});
