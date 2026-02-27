import { env } from '$env/dynamic/private';

export interface NotificationPayload {
	title: string;
	body: string;
	subtitle?: string;
	data?: Record<string, string>;
	sound?: string;
	badge?: number;
	clickAction?: string;
}

export interface SendNotificationRequest {
	token: string;
	platform?: 'ios' | 'android';
	payload: NotificationPayload;
}

export interface SendResult {
	success: boolean;
	error?: string;
}

function getBaseUrl(): string {
	const url = env.NOTIFICATION_TRIGGER_URL;
	if (url) return url;
	const port = env.NOTIFICATION_TRIGGER_PORT || '3998';
	return `http://localhost:${port}`;
}

export async function sendNotification(
	request: SendNotificationRequest
): Promise<SendResult> {
	const baseUrl = getBaseUrl();
	try {
		const response = await fetch(`${baseUrl}/api/send`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(request),
			signal: AbortSignal.timeout(15000)
		});
		const data = await response.json();
		if (data.success) return { success: true };
		return { success: false, error: data.error ?? 'Unknown error' };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : 'Request failed'
		};
	}
}

export async function getDevicesWithTokens(): Promise<
	{ token: string; platform: string; eName: string }[]
> {
	const { env } = await import('$env/dynamic/private');
	const provisionerUrl =
		env.PUBLIC_PROVISIONER_URL || env.PROVISIONER_URL || 'http://localhost:3001';
	try {
		const response = await fetch(`${provisionerUrl}/api/devices/list`, {
			signal: AbortSignal.timeout(10000)
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const data = await response.json();
		return data.devices ?? [];
	} catch (err) {
		console.error('Failed to fetch devices:', err);
		return [];
	}
}

export async function getDevicesByEName(eName: string): Promise<
	{ token: string; platform: string; eName: string }[]
> {
	const { env } = await import('$env/dynamic/private');
	const provisionerUrl =
		env.PUBLIC_PROVISIONER_URL || env.PROVISIONER_URL || 'http://localhost:3001';
	try {
		const response = await fetch(
			`${provisionerUrl}/api/devices/by-ename/${encodeURIComponent(eName)}`,
			{ signal: AbortSignal.timeout(10000) }
		);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const data = await response.json();
		return data.devices ?? [];
	} catch (err) {
		console.error('Failed to fetch devices by eName:', err);
		return [];
	}
}

export async function sendBulkNotifications(
	tokens: string[],
	payload: NotificationPayload,
	platform?: 'ios' | 'android'
): Promise<{ sent: number; failed: number; errors: { token: string; error: string }[] }> {
	const results = await Promise.all(
		tokens.map(async (token) => {
			const result = await sendNotification({
				token: token.trim(),
				platform,
				payload
			});
			return { token: token.trim(), ...result };
		})
	);

	const sent = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success);
	return {
		sent,
		failed: failed.length,
		errors: failed.map((r) => ({ token: r.token.slice(0, 20) + '...', error: r.error ?? 'Unknown' }))
	};
}

export async function checkNotificationTriggerHealth(): Promise<{
	ok: boolean;
	apns: boolean;
	fcm: boolean;
}> {
	const baseUrl = getBaseUrl();
	try {
		const response = await fetch(`${baseUrl}/api/health`, {
			signal: AbortSignal.timeout(5000)
		});
		const data = await response.json();
		return { ok: data.ok ?? false, apns: data.apns ?? false, fcm: data.fcm ?? false };
	} catch {
		return { ok: false, apns: false, fcm: false };
	}
}
