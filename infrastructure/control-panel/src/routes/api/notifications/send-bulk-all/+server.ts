import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import {
	getDevicesWithTokens,
	sendBulkNotifications
} from '$lib/services/notificationService';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { payload } = body;

		if (!payload?.title || !payload?.body) {
			return json(
				{ success: false, error: 'Missing payload.title or payload.body' },
				{ status: 400 }
			);
		}

		const devices = await getDevicesWithTokens();
		const tokens = devices.map((d) => d.token);

		if (tokens.length === 0) {
			return json(
				{
					success: false,
					error: 'No registered devices with push tokens found'
				},
				{ status: 400 }
			);
		}

		const result = await sendBulkNotifications(
			tokens,
			{
				title: String(payload.title),
				body: String(payload.body),
				subtitle: payload.subtitle ? String(payload.subtitle) : undefined,
				data: payload.data,
				sound: payload.sound ? String(payload.sound) : undefined,
				badge: payload.badge !== undefined ? Number(payload.badge) : undefined,
				clickAction: payload.clickAction ? String(payload.clickAction) : undefined
			}
			// platform auto-detected per token
		);

		return json({
			success: true,
			sent: result.sent,
			failed: result.failed,
			total: tokens.length,
			errors: result.errors
		});
	} catch (err) {
		console.error('Bulk-all send error:', err);
		return json(
			{ success: false, error: err instanceof Error ? err.message : 'Internal error' },
			{ status: 500 }
		);
	}
};
