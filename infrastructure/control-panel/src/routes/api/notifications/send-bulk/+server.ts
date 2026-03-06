import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { sendBulkNotifications } from '$lib/services/notificationService';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { tokens, platform, payload } = body;

		if (!Array.isArray(tokens) || tokens.length === 0) {
			return json({ success: false, error: 'tokens must be a non-empty array' }, { status: 400 });
		}
		if (!payload?.title || !payload?.body) {
			return json(
				{ success: false, error: 'Missing payload.title or payload.body' },
				{ status: 400 }
			);
		}

		const validTokens = tokens
			.filter((t: unknown) => typeof t === 'string' && t.trim().length > 0)
			.map((t: string) => t.trim());

		if (validTokens.length === 0) {
			return json({ success: false, error: 'No valid tokens' }, { status: 400 });
		}

		const result = await sendBulkNotifications(
			validTokens,
			{
				title: String(payload.title),
				body: String(payload.body),
				subtitle: payload.subtitle ? String(payload.subtitle) : undefined,
				data: payload.data,
				sound: payload.sound ? String(payload.sound) : undefined,
				badge: payload.badge !== undefined ? Number(payload.badge) : undefined,
				clickAction: payload.clickAction ? String(payload.clickAction) : undefined
			},
			platform && ['ios', 'android'].includes(platform) ? platform : undefined
		);

		return json({
			success: true,
			sent: result.sent,
			failed: result.failed,
			errors: result.errors
		});
	} catch (err) {
		console.error('Bulk notification send error:', err);
		return json(
			{ success: false, error: err instanceof Error ? err.message : 'Internal error' },
			{ status: 500 }
		);
	}
};
