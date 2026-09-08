import { describe, expect, it, vi } from "vitest";
import { enrichGroupOwnership } from "./group-ownership";

const ALICE = "@48468c9a-dc1b-5663-92fb-5e46e3d2a7f0";
const BOB = "@7f3d2e1a-9b8c-4d5e-8f0a-1b2c3d4e5f60";

/** Maps local ids to eNames for alice and bob, and knows nobody else. */
const lookup = vi.fn(
	async (id: string) =>
		({ "local-alice": ALICE, "local-bob": BOB })[id] ?? null,
);

describe("enrichGroupOwnership", () => {
	it("rewrites a local owner id to an eName", async () => {
		const group = await enrichGroupOwnership(
			{ owner: "local-alice", admins: [] },
			lookup,
		);
		expect(group.owner).toBe(ALICE);
	});

	it("rewrites local admin ids to eNames", async () => {
		const group = await enrichGroupOwnership(
			{ owner: "local-alice", admins: ["local-alice", "local-bob"] },
			lookup,
		);
		expect(group.admins).toEqual([ALICE, BOB]);
	});

	it("leaves values that are already eNames alone, without a lookup", async () => {
		const spy = vi.fn(async () => null);
		const group = await enrichGroupOwnership(
			{ owner: ALICE, admins: [BOB] },
			spy,
		);

		expect(group.owner).toBe(ALICE);
		expect(group.admins).toEqual([BOB]);
		expect(spy).not.toHaveBeenCalled();
	});

	it("leaves a relation-shaped admins list untouched", async () => {
		// Most platforms store admins as a `User[]` relation, and their mapping
		// reads `admins[].ename`. Flattening it to strings here would leave the
		// mapping asking for `.ename` on a string and emitting an empty list, so
		// a relation must pass through unchanged.
		const admins = [{ id: "local-bob", ename: BOB }];
		const group = await enrichGroupOwnership(
			{ owner: "local-alice", admins },
			lookup,
		);
		expect(group.admins).toEqual(admins);
	});

	it("drops admins that cannot be resolved rather than emitting an id", async () => {
		// Emitting a raw local id would put a reference on the wire that no
		// consumer accepts, which is the failure this whole change removes.
		const group = await enrichGroupOwnership(
			{
				owner: "local-alice",
				admins: ["local-alice", "who-is-this", null, 42],
			},
			lookup,
		);
		expect(group.admins).toEqual([ALICE]);
	});

	it("yields a null owner when the owner cannot be resolved", async () => {
		const group = await enrichGroupOwnership(
			{ owner: "who-is-this", admins: [] },
			lookup,
		);
		expect(group.owner).toBeNull();
	});

	it("survives a lookup that throws", async () => {
		const group = await enrichGroupOwnership(
			{ owner: "local-alice", admins: [] },
			async () => {
				throw new Error("db down");
			},
		);
		expect(group.owner).toBeNull();
	});

	it("leaves absent fields absent and does not invent them", async () => {
		const group = await enrichGroupOwnership({ name: "Standup" }, lookup);
		expect(group).toEqual({ name: "Standup" });
	});

	it("is idempotent", async () => {
		const once = await enrichGroupOwnership(
			{ owner: "local-alice", admins: ["local-bob"] },
			lookup,
		);
		const twice = await enrichGroupOwnership(once, lookup);
		expect(twice).toEqual(once);
	});

	it("never fabricates an eName from an unresolved local id", async () => {
		// `@` + a local uuid is syntactically a valid eName and semantically
		// nobody. Emitting one would recreate the exact failure this change
		// removes: a reference that looks fine and resolves to no one.
		const group = await enrichGroupOwnership(
			{ owner: "3f8c1e2d-0000-4444-8888-aaaabbbbcccc", admins: [] },
			async () => null,
		);

		expect(group.owner).toBeNull();
		expect(group.owner).not.toBe("@3f8c1e2d-0000-4444-8888-aaaabbbbcccc");
	});
});
