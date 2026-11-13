/**
 * Everything this app knows about the network comes from Awareness-as-a-Service.
 *
 * Accreditations, deployment profiles and platform profiles each have their own
 * ontology, so they can be asked for directly rather than scanned for.
 */

import { awarenessApiKey, awarenessUrl } from "./env";
import {
	DEPLOYMENT_PROFILE_ONTOLOGY,
	PLATFORM_ACCREDITATION_ONTOLOGY,
	USER_ONTOLOGY,
	type AccreditationRecord,
	type DeploymentRecord,
} from "./ontology";

interface Packet {
	id: string;
	ontology: string;
	w3id: string | null;
	data: Record<string, any> | null;
	receivedAt: string;
}

export function isConfigured(): boolean {
	return Boolean(awarenessApiKey());
}

async function packets(params: Record<string, string>): Promise<Packet[]> {
	if (!isConfigured()) return [];
	const out: Packet[] = [];
	let cursor: string | null = null;
	do {
		const query = new URLSearchParams({ limit: "500", ...params });
		if (cursor) query.set("cursor", cursor);
		const res = await fetch(`${awarenessUrl().replace(/\/$/, "")}/api/packets?${query}`, {
			headers: { Authorization: `Bearer ${awarenessApiKey()}` },
			signal: AbortSignal.timeout(30_000),
		});
		if (!res.ok) {
			throw new Error(`AaaS /api/packets returned ${res.status}`);
		}
		const body = (await res.json()) as {
			packets?: Packet[];
			hasMore?: boolean;
			nextCursor?: string | null;
		};
		out.push(...(body.packets ?? []));
		cursor = body.hasMore ? (body.nextCursor ?? null) : null;
	} while (cursor);
	return out;
}

/** Short cache: these reads back every page and the data changes rarely. */
const TTL_MS = 30_000;
const CACHE = Symbol.for("pp-auth-demo.aaas");
const store = globalThis as typeof globalThis & {
	[CACHE]?: Map<string, { at: number; value: unknown }>;
};
store[CACHE] ??= new Map();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
	const entry = store[CACHE]!.get(key);
	if (entry && Date.now() - entry.at < TTL_MS) return entry.value as T;
	const value = await load();
	store[CACHE]!.set(key, { at: Date.now(), value });
	return value;
}

export function invalidate(): void {
	store[CACHE]!.clear();
}

function str(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/**
 * Every certification decision on the network, newest first.
 *
 * A decision covers one platform version, and a version can be refused and
 * reapply, so several may exist for the same release.
 */
export async function accreditations(): Promise<AccreditationRecord[]> {
	return cached("accreditations", async () => {
		const found = await packets({ ontology: PLATFORM_ACCREDITATION_ONTOLOGY });
		return found
			.map((packet) => packet.data)
			.filter(
				(data): data is AccreditationRecord =>
					Boolean(data) &&
					typeof data!.platformEName === "string" &&
					typeof data!.jws === "string",
			)
			.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
	});
}

/** Every deployment published on the network. */
export async function deployments(): Promise<DeploymentRecord[]> {
	return cached("deployments", async () => {
		const found = await packets({ ontology: DEPLOYMENT_PROFILE_ONTOLOGY });
		const byEname = new Map<string, DeploymentRecord>();
		for (const packet of found) {
			const data = packet.data;
			if (!data || !str(data.deploymentEname)) continue;
			byEname.set(str(data.deploymentEname), data as DeploymentRecord);
		}
		return [...byEname.values()];
	});
}

export interface PlatformProfile {
	ename: string;
	platformName: string;
	displayName: string;
	description: string;
	version: string;
	logoUrl: string | null;
	url: string;
	/** Every release proof the platform retains, so an older deployment resolves. */
	proofs: Array<Record<string, any>>;
}

/** One platform's own profile, read from its eVault. */
export async function platformProfile(ename: string): Promise<PlatformProfile | null> {
	return cached(`profile:${ename}`, async () => {
		const found = await packets({ evault: ename, ontology: USER_ONTOLOGY });
		const data = found
			.map((packet) => packet.data)
			.filter((d): d is Record<string, any> => Boolean(d) && Boolean(str(d!.platformName)))
			.at(-1);
		if (!data) return null;
		const proofs = [
			...(Array.isArray(data.submissionHistory) ? data.submissionHistory : []),
			data.submissionProof,
		].filter((proof) => proof && typeof proof === "object" && proof.statement);
		return {
			ename,
			platformName: str(data.platformName),
			displayName: str(data.displayName) || str(data.platformName),
			description: str(data.description),
			version: str(data.version),
			logoUrl: str(data.logoUrl) || null,
			url: str(data.url),
			proofs,
		};
	});
}

/** A person's profile, for showing who deployed something. */
export async function personProfile(
	ename: string,
): Promise<{ ename: string; displayName: string; avatarUrl: string | null }> {
	return cached(`person:${ename}`, async () => {
		const fallback = { ename, displayName: ename, avatarUrl: null };
		try {
			const found = await packets({ evault: ename, ontology: USER_ONTOLOGY });
			const data = found
				.map((packet) => packet.data)
				.filter((d): d is Record<string, any> => Boolean(d) && !str(d!.platformName))
				.at(-1);
			if (!data) return fallback;
			return {
				ename,
				displayName:
					str(data.displayName) || str(data.name) || str(data.username) || ename,
				avatarUrl: str(data.avatarUrl) || str(data.avatar) || null,
			};
		} catch {
			return fallback;
		}
	});
}
