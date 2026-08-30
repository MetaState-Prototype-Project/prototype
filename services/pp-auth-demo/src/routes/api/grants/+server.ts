import { json } from "@sveltejs/kit";
import type { Operation } from "@metastate-foundation/auth/platform";
import { currentGrants, setGrant } from "$lib/server/grants";
import type { RequestHandler } from "./$types";

/**
 * Records what one platform may do with one kind of data.
 *
 * Writes an `AccessGrant` into the owner's own eVault. Clearing both operations
 * withdraws the grant rather than deleting it, so the record shows access was
 * taken away rather than never given.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { platformEname, domain, operations } = (await request.json()) as {
		platformEname?: string;
		domain?: string;
		operations?: string[];
	};
	if (!platformEname || !domain) {
		return json({ error: "platformEname and domain are required" }, { status: 400 });
	}

	const wanted = (operations ?? []).filter(
		(operation): operation is Operation => operation === "read" || operation === "write",
	);

	const ename = locals.user!.ename;
	try {
		await setGrant(ename, platformEname, domain, wanted, await currentGrants(ename));
		return json({ ok: true });
	} catch (error) {
		console.error("[pp-auth-demo/grants] could not write the grant:", error);
		return json(
			{ error: error instanceof Error ? error.message : "could not save" },
			{ status: 500 },
		);
	}
};
