import { CONTROL_PANEL_ADMIN_ENAMES_FILE } from '$env/static/private';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_ALLOWLIST_PATH = 'config/admin-enames.json';

type AllowlistData = {
	admins?: string[];
};

let cachedPath: string | null = null;
let cachedMtimeMs = -1;
let cachedAdmins = new Set<string>();

export function normalizeEName(value: string): string {
	const trimmed = value.trim().toLowerCase();
	if (!trimmed) return '';
	return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

function getAllowlistPath(): string {
	const configuredPath = CONTROL_PANEL_ADMIN_ENAMES_FILE?.trim();
	return resolve(process.cwd(), configuredPath || DEFAULT_ALLOWLIST_PATH);
}

export async function getAdminAllowlist(): Promise<Set<string>> {
	const allowlistPath = getAllowlistPath();

	try {
		const fileStat = await stat(allowlistPath);
		const shouldRefresh = allowlistPath !== cachedPath || fileStat.mtimeMs !== cachedMtimeMs;

		if (!shouldRefresh) {
			return cachedAdmins;
		}

		const raw = await readFile(allowlistPath, 'utf8');
		const parsed = JSON.parse(raw) as AllowlistData;
		const admins = Array.isArray(parsed.admins) ? parsed.admins : [];
		const normalized = new Set(admins.map(normalizeEName).filter(Boolean));

		cachedPath = allowlistPath;
		cachedMtimeMs = fileStat.mtimeMs;
		cachedAdmins = normalized;

		return cachedAdmins;
	} catch (error) {
		console.error(`[auth] Failed loading admin allowlist from ${allowlistPath}:`, error);
		cachedPath = allowlistPath;
		cachedMtimeMs = -1;
		cachedAdmins = new Set();
		return cachedAdmins;
	}
}

export async function isAdminEName(ename: string): Promise<boolean> {
	const normalized = normalizeEName(ename);
	if (!normalized) return false;
	const allowlist = await getAdminAllowlist();
	return allowlist.has(normalized);
}
