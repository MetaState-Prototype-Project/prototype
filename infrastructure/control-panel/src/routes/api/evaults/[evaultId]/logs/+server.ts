import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lokiService } from '$lib/services/loki';
import { registryService } from '$lib/services/registry';

export const GET: RequestHandler = async ({ params, url }) => {
	const { evaultId } = params;
	const tail = parseInt(url.searchParams.get('tail') || '100', 10);

	try {
		// Get evault information from registry to find ename
		const evaults = await registryService.getEVaults();
		const evault = evaults.find((v) => v.evault === evaultId || v.ename === evaultId);

		if (!evault) {
			return json(
				{
					error: `eVault '${evaultId}' not found in registry.`,
					logs: []
				},
				{ status: 404 }
			);
		}

		// Query Loki for logs using evault identifier
		const logs = await lokiService.getEVaultLogs(evault.evault || evaultId, evault.ename, tail);

		return json({ logs });
	} catch (error: any) {
		console.error('Error fetching logs:', error);

		return json(
			{
				error: 'Failed to fetch logs. Please check if the eVault is still running and Loki is accessible.',
				logs: []
			},
			{ status: 500 }
		);
	}
};
