import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import {
	getDevicesByEName,
	sendBulkNotifications
} from '$lib/services/notificationService';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { eName, payload } = body;

		if (!eName || typeof eName !== 'string' || !eName.trim()) {
			return json(
				{ success: false, error: 'Missing or invalid eName' },
				{ status: 400 }
			);
		}
		if (!payload?.title || !payload?.body) {
			return json(
				{ success: false, error: 'Missing payload.title or payload.body' },
				{ status: 400 }
			);
		}

		const devices = await getDevicesByEName(eName.trim());
		const tokens = devices.map((d) => d.token);

		if (tokens.length === 0) {
			return json(
				{
					success: false,
					error: `No devices with push tokens found for eName: ${eName}`
				},
				{ status: 400 }
			);
		}

		const result = await sendBulkNotifications(tokens, {
			title: String(payload.title),
			body: String(payload.body),
			subtitle: payload.subtitle ? String(payload.subtitle) : undefined,
			data: payload.data,
			sound: payload.sound ? String(payload.sound) : undefined,
			badge: payload.badge !== undefined ? Number(payload.badge) : undefined,
			clickAction: payload.clickAction ? String(payload.clickAction) : undefined
		});

		return json({
			success: true,
			sent: result.sent,
			failed: result.failed,
			total: tokens.length,
			errors: result.errors
		});
	} catch (err) {
		console.error('Send by eName error:', err);
		return json(
			{ success: false, error: err instanceof Error ? err.message : 'Internal error' },
			{ status: 500 }
		);
	}
};
