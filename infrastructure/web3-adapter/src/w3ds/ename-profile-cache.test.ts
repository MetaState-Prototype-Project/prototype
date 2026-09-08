import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENameProfileCache } from "./ename-profile-cache";

const ALICE = "@48468c9a-dc1b-5663-92fb-5e46e3d2a7f0";
const BOB = "@7f3d2e1a-9b8c-4d5e-8f0a-1b2c3d4e5f60";

describe("ENameProfileCache", () => {
	beforeEach(() => {
		vi.useRealTimers();
	});

	it("loads once and serves repeats from cache", async () => {
		const load = vi.fn(async (ename: string) => ({ name: ename }));
		const cache = new ENameProfileCache({ load });

		expect(await cache.get(ALICE)).toEqual({ name: ALICE });
		expect(await cache.get(ALICE)).toEqual({ name: ALICE });
		expect(await cache.get(ALICE)).toEqual({ name: ALICE });

		expect(load).toHaveBeenCalledTimes(1);
	});

	it("collapses a concurrent burst into a single load", async () => {
		// The room-render case: every participant tile asks at once.
		const load = vi.fn(
			async (ename: string) =>
				new Promise<{ name: string }>((resolve) =>
					setTimeout(() => resolve({ name: ename }), 10),
				),
		);
		const cache = new ENameProfileCache({ load });

		const results = await Promise.all([
			cache.get(ALICE),
			cache.get(ALICE),
			cache.get(ALICE),
		]);

		expect(results).toEqual([
			{ name: ALICE },
			{ name: ALICE },
			{ name: ALICE },
		]);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("caches a miss so unknown participants are not re-queried", async () => {
		// A member on a platform this instance knows nothing about is a normal,
		// permanent condition — not something to retry on every render.
		const load = vi.fn(async () => null);
		const cache = new ENameProfileCache({ load });

		expect(await cache.get(ALICE)).toBeNull();
		expect(await cache.get(ALICE)).toBeNull();

		expect(load).toHaveBeenCalledTimes(1);
	});

	it("reloads after the TTL expires", async () => {
		vi.useFakeTimers();
		const load = vi.fn(async (ename: string) => ({ name: ename }));
		const cache = new ENameProfileCache({ load, ttlMs: 1000 });

		await cache.get(ALICE);
		vi.advanceTimersByTime(1500);
		await cache.get(ALICE);

		expect(load).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});

	it("does not cache a failed lookup", async () => {
		// A transient failure must not be remembered for the whole TTL.
		const load = vi
			.fn<(ename: string) => Promise<{ name: string } | null>>()
			.mockRejectedValueOnce(new Error("registry down"))
			.mockResolvedValueOnce({ name: ALICE });
		const cache = new ENameProfileCache({ load });

		expect(await cache.get(ALICE)).toBeNull();
		expect(await cache.get(ALICE)).toEqual({ name: ALICE });
		expect(load).toHaveBeenCalledTimes(2);
	});

	it("resolves many eNames and omits the unknown ones", async () => {
		const load = vi.fn(async (ename: string) =>
			ename === ALICE ? { name: "Alice" } : null,
		);
		const cache = new ENameProfileCache({ load });

		const found = await cache.getMany([ALICE, BOB, ALICE]);

		expect(found.get(ALICE)).toEqual({ name: "Alice" });
		expect(found.has(BOB)).toBe(false);
		// ALICE appears twice in the input but is loaded once.
		expect(load).toHaveBeenCalledTimes(2);
	});

	it("evicts oldest entries past the cap", async () => {
		const load = vi.fn(async (ename: string) => ({ name: ename }));
		const cache = new ENameProfileCache({ load, maxEntries: 2 });

		await cache.get("@a");
		await cache.get("@b");
		await cache.get("@c"); // evicts @a
		await cache.get("@a"); // reloads

		expect(load).toHaveBeenCalledTimes(4);
	});

	it("invalidates a single entry on demand", async () => {
		const load = vi.fn(async (ename: string) => ({ name: ename }));
		const cache = new ENameProfileCache({ load });

		await cache.get(ALICE);
		cache.invalidate(ALICE);
		await cache.get(ALICE);

		expect(load).toHaveBeenCalledTimes(2);
	});
});
