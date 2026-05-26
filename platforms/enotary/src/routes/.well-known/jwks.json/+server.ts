import { json } from "@sveltejs/kit";
import { getJWKS } from "$lib/server/jwt";

export async function GET() {
    const jwks = await getJWKS();
    return json(jwks);
}
