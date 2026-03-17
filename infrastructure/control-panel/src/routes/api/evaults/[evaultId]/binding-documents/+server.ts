import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { registryService } from '$lib/services/registry';
import { evaultService } from '$lib/server/evault';

export const GET: RequestHandler = async ({ params }) => {
	const { evaultId } = params;

	try {
		const evaults = await registryService.getEVaults();
		const vault = evaults.find((v) => v.evault === evaultId || v.ename === evaultId);

		if (!vault) {
			return json({ error: `eVault '${evaultId}' not found in registry.` }, { status: 404 });
		}

		const result = await evaultService.fetchBindingDocuments(vault.ename);
		return json(result);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Failed to fetch binding documents';
		return json({ error: message }, { status: 500 });
	}
};
