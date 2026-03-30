import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_CONTROL_PANEL_URL } from '$env/static/public';
import {
	fetchRegistryEvaultRows,
	requestPlatformToken,
	type RegistryEvaultRow
} from '$lib/server/evault-graphql';

export type EVault = RegistryEvaultRow;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const platform = PUBLIC_CONTROL_PANEL_URL || url.origin;
		let token: string | undefined;
		try {
			token = await requestPlatformToken(platform);
		} catch (tokenError) {
			console.warn('Falling back to X-ENAME-only eVault queries:', tokenError);
		}

		const evaults: EVault[] = await fetchRegistryEvaultRows(token);

		// Filter out platform-owned user profiles (e.g. "File Manager Platform").
		const filteredEVaults = evaults.filter(
			(vault) => !(vault.type === 'user' && /platform$/i.test(vault.name.trim()))
		);

		console.log(`Total eVaults found: ${filteredEVaults.length}`);
		return json({ evaults: filteredEVaults });
	} catch (error) {
		console.error('Error fetching eVaults:', error);
		return json({ error: 'Failed to fetch eVaults', evaults: [] }, { status: 500 });
	}
};
