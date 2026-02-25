import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { checkNotificationTriggerHealth } from '$lib/services/notificationService';

export const GET: RequestHandler = async () => {
	try {
		const health = await checkNotificationTriggerHealth();
		return json(health);
	} catch {
		return json({ ok: false, apns: false, fcm: false });
	}
};
