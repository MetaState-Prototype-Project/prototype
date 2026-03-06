import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { sendNotification } from '$lib/services/notificationService';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { token, platform, payload } = body;

		if (!token || typeof token !== 'string') {
			return json({ success: false, error: 'Missing or invalid token' }, { status: 400 });
		}
		if (!payload?.title || !payload?.body) {
			return json(
				{ success: false, error: 'Missing payload.title or payload.body' },
				{ status: 400 }
			);
		}

		const result = await sendNotification({
			token: token.trim(),
			platform,
			payload: {
				title: String(payload.title),
				body: String(payload.body),
				subtitle: payload.subtitle ? String(payload.subtitle) : undefined,
				data: payload.data,
				sound: payload.sound ? String(payload.sound) : undefined,
				badge: payload.badge !== undefined ? Number(payload.badge) : undefined,
				clickAction: payload.clickAction ? String(payload.clickAction) : undefined
			}
		});

		if (result.success) {
			return json({ success: true, message: 'Notification sent' });
		}
		return json({ success: false, error: result.error }, { status: 500 });
	} catch (err) {
		console.error('Notification send error:', err);
		return json(
			{ success: false, error: err instanceof Error ? err.message : 'Internal error' },
			{ status: 500 }
		);
	}
};
