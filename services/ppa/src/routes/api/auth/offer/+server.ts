import { json } from "@sveltejs/kit";
import { createOffer } from "$lib/server/w3ds";

/** Starts a login and hands back a w3ds://auth offer for the QR code. */
export async function POST() {
    return json(createOffer());
}
