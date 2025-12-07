import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { registryService } from '$lib/services/registry';

export interface EVault {
	id: string; // evault identifier (evault field from registry)
	name: string; // display name (ename or evault)
	ename: string; // w3id identifier
	uri: string; // resolved service URI
	evault: string; // evault identifier
	status: string; // derived from health check
	serviceUrl?: string; // same as uri for display
}

export const GET: RequestHandler = async () => {
	try {
		// Fetch all evaults from registry
		const registryVaults = await registryService.getEVaults();

		// Transform registry vaults to EVault format
		const evaults: EVault[] = await Promise.all(
			registryVaults.map(async (vault) => {
				// Use evault identifier as the primary ID, fallback to ename
				const evaultId = vault.evault || vault.ename;

				// Determine display name (prefer ename, fallback to evault)
				const displayName = vault.ename || vault.evault || 'Unknown';

				// Check health status by attempting to fetch from URI
				let status = 'Unknown';
				try {
					const healthResponse = await fetch(`${vault.uri}/health`, {
						signal: AbortSignal.timeout(2000) // 2 second timeout
					});
					status = healthResponse.ok ? 'Active' : 'Inactive';
				} catch {
					status = 'Inactive';
				}

				return {
					id: evaultId,
					name: displayName,
					ename: vault.ename,
					uri: vault.uri,
					evault: vault.evault,
					status: status,
					serviceUrl: vault.uri
				};
			})
		);

		console.log(`Total eVaults found: ${evaults.length}`);
		return json({ evaults });
	} catch (error) {
		console.error('Error fetching eVaults:', error);
		return json({ error: 'Failed to fetch eVaults', evaults: [] }, { status: 500 });
	}
};
