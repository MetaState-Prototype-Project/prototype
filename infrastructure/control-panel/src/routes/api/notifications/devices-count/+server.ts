import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getDevicesWithTokens } from '$lib/services/notificationService';

export const GET: RequestHandler = async () => {
	try {
		const devices = await getDevicesWithTokens();
		return json({ count: devices.length });
	} catch {
		return json({ count: 0 });
	}
};
