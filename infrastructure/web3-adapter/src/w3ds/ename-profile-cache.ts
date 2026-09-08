/**
 * A small TTL cache for eName → profile lookups.
 *
 * Under the old envelope-id scheme a participant reference dereferenced
 * straight to a full User record, so display names and avatars arrived free as
 * part of the mapping. An eName carries identity but no profile data, so
 * hydrating a room's members is now a separate lookup per member — an N+1 on
 * every render if left alone. This caches those lookups.
 *
 * Misses are cached too. A participant who lives on a platform this instance
 * knows nothing about is a normal, permanent condition, and re-querying for
 * them on every render is exactly the cost this exists to avoid.
 */
export interface ENameProfileCacheOptions<T> {
	/** Resolves one eName to a profile, or `null` when nobody is known by it. */
	load: (ename: string) => Promise<T | null>;
	/** How long an entry stays fresh. Defaults to five minutes. */
	ttlMs?: number;
	/** Maximum entries retained. Defaults to 1000. */
	maxEntries?: number;
}

interface CacheEntry<T> {
	value: T | null;
	expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 1000;

export class ENameProfileCache<T> {
	private entries = new Map<string, CacheEntry<T>>();
	/** In-flight loads, so a burst for one eName makes a single query. */
	private inflight = new Map<string, Promise<T | null>>();
	private readonly load: (ename: string) => Promise<T | null>;
	private readonly ttlMs: number;
	private readonly maxEntries: number;

	constructor(options: ENameProfileCacheOptions<T>) {
		this.load = options.load;
		this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
		this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
	}

	async get(ename: string): Promise<T | null> {
		const cached = this.entries.get(ename);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.value;
		}
		this.entries.delete(ename);

		const existing = this.inflight.get(ename);
		if (existing) return existing;

		const pending = this.load(ename)
			.then((value) => {
				this.set(ename, value);
				return value;
			})
			.catch((error) => {
				// A failed lookup is not cached: unlike "nobody is known by this
				// eName", a transient failure should not be remembered for the
				// whole TTL.
				console.warn(`[ename-cache] failed to load profile ${ename}:`, error);
				return null;
			})
			.finally(() => {
				this.inflight.delete(ename);
			});

		this.inflight.set(ename, pending);
		return pending;
	}

	/** Resolves many eNames at once, returning only those that are known. */
	async getMany(enames: readonly string[]): Promise<Map<string, T>> {
		const unique = [...new Set(enames)];
		const resolved = await Promise.all(
			unique.map(async (ename) => [ename, await this.get(ename)] as const),
		);

		const found = new Map<string, T>();
		for (const [ename, value] of resolved) {
			if (value !== null && value !== undefined) found.set(ename, value);
		}
		return found;
	}

	/** Drops an entry, for when a profile is known to have changed. */
	invalidate(ename: string): void {
		this.entries.delete(ename);
	}

	clear(): void {
		this.entries.clear();
	}

	private set(ename: string, value: T | null): void {
		// Oldest-first eviction. Insertion order is Map's iteration order, and a
		// refreshed entry is deleted before being re-set, so it moves to the back.
		if (this.entries.size >= this.maxEntries) {
			const oldest = this.entries.keys().next();
			if (!oldest.done) this.entries.delete(oldest.value);
		}
		this.entries.set(ename, { value, expiresAt: Date.now() + this.ttlMs });
	}
}
