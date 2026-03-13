import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
	const baseUrl = env.EREPUTATION_BASE_URL || 'http://localhost:8765';

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);
		const response = await fetch(`${baseUrl}/api/references/all`, {
			headers: env.VISUALIZER_API_KEY ? { 'x-visualizer-key': env.VISUALIZER_API_KEY } : {},
			signal: controller.signal,
		});
		clearTimeout(timeout);
		

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
