import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { adminEnamesCsv, adminEnamesFile } from "./env";

/**
 * The whitelist of eNames allowed to act as PPA admins. Sourced from a JSON
 * file (hot-reloaded on mtime change, so an eName can be added without a
 * restart) unioned with an optional PPA_ADMIN_ENAMES csv for container
 * deployments where mounting a file is awkward.
 *
 * Mirrors infrastructure/control-panel/src/lib/server/auth/allowlist.ts.
 */

type AllowlistData = {
    admins?: string[];
};

let cachedPath: string | null = null;
let cachedMtimeMs = -1;
let cachedFileAdmins = new Set<string>();

export function normalizeEName(value: string): string {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return "";
    return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function getAllowlistPath(): string {
    return resolve(process.cwd(), adminEnamesFile());
}

function csvAdmins(): Set<string> {
    return new Set(
        adminEnamesCsv().split(",").map(normalizeEName).filter(Boolean),
    );
}

async function fileAdmins(): Promise<Set<string>> {
    const allowlistPath = getAllowlistPath();

    try {
        const fileStat = await stat(allowlistPath);
        const shouldRefresh =
            allowlistPath !== cachedPath || fileStat.mtimeMs !== cachedMtimeMs;

        if (!shouldRefresh) return cachedFileAdmins;

        const raw = await readFile(allowlistPath, "utf8");
        const parsed = JSON.parse(raw) as AllowlistData;
        const admins = Array.isArray(parsed.admins) ? parsed.admins : [];

        cachedPath = allowlistPath;
        cachedMtimeMs = fileStat.mtimeMs;
        cachedFileAdmins = new Set(admins.map(normalizeEName).filter(Boolean));

        return cachedFileAdmins;
    } catch (error) {
        console.error(
            `[ppa/allowlist] failed loading admin allowlist from ${allowlistPath}:`,
            error,
        );
        cachedPath = allowlistPath;
        cachedMtimeMs = -1;
        cachedFileAdmins = new Set();
        return cachedFileAdmins;
    }
}

export async function getAdminAllowlist(): Promise<Set<string>> {
    const fromFile = await fileAdmins();
    return new Set([...fromFile, ...csvAdmins()]);
}

export async function isAdminEName(ename: string): Promise<boolean> {
    const normalized = normalizeEName(ename);
    if (!normalized) return false;
    return (await getAdminAllowlist()).has(normalized);
}
