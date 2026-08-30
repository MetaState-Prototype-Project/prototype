import { json } from "@sveltejs/kit";
import { createLoginOffer } from "$lib/server/session";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async () => json(createLoginOffer());
