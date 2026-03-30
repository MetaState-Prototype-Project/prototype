import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_CONTROL_PANEL_URL } from '$env/static/public';
import { fetchRegistryEvaultRows, requestPlatformToken } from '$lib/server/evault-graphql';
import type { EVault } from '../+server';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const platform = PUBLIC_CONTROL_PANEL_URL || url.origin;
		let token: string | undefined;
		try {
			token = await requestPlatformToken(platform);
		} catch (tokenError) {
			console.warn('Falling back to X-ENAME-only eVault queries:', tokenError);
		}

		const rows = await fetchRegistryEvaultRows(token);
		const evaults: EVault[] = rows.filter((v) => v.type === 'group');

		return json({ evaults });
	} catch (error) {
		console.error('Error fetching group eVaults:', error);
		return json({ error: 'Failed to fetch group eVaults', evaults: [] }, { status: 500 });
	}
};
