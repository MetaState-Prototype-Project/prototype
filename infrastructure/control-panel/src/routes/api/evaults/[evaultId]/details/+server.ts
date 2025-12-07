import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { registryService } from '$lib/services/registry';

export const GET: RequestHandler = async ({ params }) => {
	const { evaultId } = params;

	try {
		// Get evault information from registry
		const evaults = await registryService.getEVaults();
		const evault = evaults.find((v) => v.evault === evaultId || v.ename === evaultId);

		if (!evault) {
			return json({ error: `eVault '${evaultId}' not found in registry.` }, { status: 404 });
		}

		// Check health status
		let healthStatus = 'Unknown';
		try {
			const healthResponse = await fetch(`${evault.uri}/health`, {
				signal: AbortSignal.timeout(2000) // 2 second timeout
			});
			healthStatus = healthResponse.ok ? 'Healthy' : 'Unhealthy';
		} catch {
			healthStatus = 'Unreachable';
		}

		return json({
			evault: {
				ename: evault.ename,
				uri: evault.uri,
				evault: evault.evault,
				originalUri: evault.originalUri,
				resolved: evault.resolved,
				healthStatus
			}
		});
	} catch (error) {
		console.error('Error fetching evault details:', error);
		return json({ error: 'Failed to fetch evault details' }, { status: 500 });
	}
};
