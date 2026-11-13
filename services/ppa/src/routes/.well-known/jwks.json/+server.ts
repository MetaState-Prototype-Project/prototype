import { json } from "@sveltejs/kit";
import { getJWKS } from "$lib/server/jwt";

/**
 * Public key set for every accreditation the PPA signs. Deliberately
 * unauthenticated — this is what makes a decision verifiable by anyone.
 */
export async function GET() {
    return json(await getJWKS(), {
        headers: { "cache-control": "public, max-age=300" },
    });
}
