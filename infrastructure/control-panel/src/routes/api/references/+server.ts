import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
	const baseUrl = env.VITE_EREPUTATION_BASE_URL || 'http://localhost:8765';

	try {
		const response = await fetch(`${baseUrl}/api/references/all`);

		if (!response.ok) {
			console.error('eReputation API error:', response.status, response.statusText);
			return json({ error: 'Failed to fetch references', references: [] }, { status: 500 });
		}

		const data = await response.json();
		return json(data);
	} catch (error) {
		console.error('Error fetching references from eReputation:', error);
		return json({ error: 'Failed to connect to eReputation API', references: [] }, { status: 500 });
	}
};
