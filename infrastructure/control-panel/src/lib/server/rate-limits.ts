import { env } from '$env/dynamic/private';
import { PUBLIC_PROVISIONER_URL, PUBLIC_REGISTRY_URL } from '$env/static/public';
import { isAdminEName } from '$lib/server/auth/allowlist';
import { error } from '@sveltejs/kit';

export type RateLimitKind = 'platform' | 'ip';
export type RateLimitMode = 'limit' | 'blocked' | 'exempt';
export type LimitSource = 'db' | 'env';

export interface RateLimitRule {
	id: string;
	kind: RateLimitKind;
	subject: string;
	mode: RateLimitMode;
	limitPerMinute: number | null;
	note: string | null;
	updatedBy: string | null;
	updatedAt: string;
}

export interface RateLimitConfig {
	windowSeconds: number;
	config: { source: LimitSource; loadedAt: string };
	trustProxy: boolean | number | string;
	defaults: {
		platform: { limit: number; source: LimitSource };
		ip: { limit: number; source: LimitSource };
	};
	rules: RateLimitRule[];
}

export interface UsageRow {
	subject: string;
	count: number;
	rejected: number;
	limit: number;
	mode: RateLimitMode;
	matchedRule: string | null;
	resetsInSeconds: number;
}

export interface RateLimitUsage {
	generatedAt: string;
	windowSeconds: number;
	platforms: UsageRow[];
	ips: UsageRow[];
	truncated: boolean;
}

/** An evault-core answer worth showing the admin as it is. */
export class RateLimitApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly field?: string
	) {
		super(message);
	}
}

/**
 * The signed-in admin's eName. The allowlist is re-read here because the
 * session cookie outlives a removal from it.
 */
export async function requireAdmin(locals: App.Locals): Promise<string> {
	const ename = locals.user?.ename;
	if (!ename || !(await isAdminEName(ename))) {
		throw error(403, 'Not an admin');
	}
	return ename;
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
	const secret = env.RATE_LIMIT_ADMIN_SECRET;
	if (!secret) {
		throw new RateLimitApiError(
			'RATE_LIMIT_ADMIN_SECRET is not set for the control panel',
			503
		);
	}
	const baseUrl = PUBLIC_PROVISIONER_URL || 'http://localhost:3001';

	let response: Response;
	try {
		response = await fetch(`${baseUrl}${path}`, {
			...init,
			headers: {
				'Content-Type': 'application/json',
				'x-shared-secret': secret,
				...init.headers
			},
			signal: AbortSignal.timeout(10000)
		});
	} catch {
		throw new RateLimitApiError('Could not reach evault-core', 502);
	}

	if (response.ok) return response;
	if (response.status === 401) {
		throw new RateLimitApiError(
			'evault-core rejected RATE_LIMIT_ADMIN_SECRET; it must match on both services',
			502
		);
	}
	if (response.status === 503) {
		throw new RateLimitApiError('RATE_LIMIT_ADMIN_SECRET is not set for evault-core', 503);
	}
	const body = await response.json().catch(() => null);
	throw new RateLimitApiError(
		body?.error ?? `evault-core answered ${response.status}`,
		response.status,
		body?.field
	);
}

export async function getRateLimitConfig(): Promise<RateLimitConfig> {
	return (await call('/admin/rate-limits')).json();
}

export async function getRateLimitUsage(): Promise<RateLimitUsage> {
	return (await call('/admin/rate-limits/usage')).json();
}

export async function saveRateLimitRule(
	rule: Record<string, unknown>,
	updatedBy: string
): Promise<RateLimitRule> {
	const response = await call('/admin/rate-limits/rules', {
		method: 'PUT',
		body: JSON.stringify({ ...rule, updatedBy })
	});
	return (await response.json()).rule;
}

export async function deleteRateLimitRule(id: string, removedBy: string): Promise<void> {
	await call(`/admin/rate-limits/rules/${encodeURIComponent(id)}`, {
		method: 'DELETE',
		headers: { 'x-admin-ename': removedBy }
	});
}

/** Platform names the Registry lists, to offer before they have traffic. */
export async function getKnownPlatforms(): Promise<string[]> {
	if (!PUBLIC_REGISTRY_URL) return [];
	try {
		const response = await fetch(new URL('/platforms', PUBLIC_REGISTRY_URL), {
			signal: AbortSignal.timeout(5000)
		});
		if (!response.ok) return [];
		const platforms: unknown[] = await response.json();
		return platforms.filter((p): p is string => typeof p === 'string' && p.trim() !== '');
	} catch {
		return [];
	}
}

/** The JSON answer for a failed call, keeping evault-core's own message. */
export function errorResponse(err: unknown): Response {
	if (err instanceof RateLimitApiError) {
		return Response.json({ error: err.message, field: err.field }, { status: err.status });
	}
	throw err;
}
