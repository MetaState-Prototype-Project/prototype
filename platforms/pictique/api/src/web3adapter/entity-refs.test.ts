import { describe, expect, it, vi } from "vitest";
import { resolveEntityRef, resolveParticipants } from "./entity-refs";
import type { UserService } from "../services/UserService";
import type { User } from "../database/entities/User";

const ALICE = "@48468c9a-dc1b-5663-92fb-5e46e3d2a7f0";
const BOB = "@7f3d2e1a-9b8c-4d5e-8f0a-1b2c3d4e5f60";
/** Well-formed, but nobody on this instance answers to it. */
const STRANGER = "@0c0ffee0-dead-4bee-8fee-000000000000";

function user(ename: string, name: string): User {
	return { id: `local-${name}`, ename, name } as User;
}

/** A UserService that knows Alice and Bob and nobody else. */
function userService(): UserService {
	const known = new Map([
		[ALICE, user(ALICE, "alice")],
		[BOB, user(BOB, "bob")],
	]);
	return {
		findByEname: vi.fn(async (ename: string) => known.get(ename) ?? null),
		findById: vi.fn(async () => {
			throw new Error(
				"entity references must resolve by eName, never by envelope id",
			);
		}),
	} as unknown as UserService;
}

describe("chat entity references", () => {
	describe("resolveParticipants", () => {
		it("resolves a participant list of eNames", async () => {
			const svc = userService();
			const resolved = await resolveParticipants([ALICE, BOB], svc, "test");

			expect(resolved.map((u) => u.ename)).toEqual([ALICE, BOB]);
			expect(svc.findById).not.toHaveBeenCalled();
		});

		it("keeps the room when one participant is unresolvable", async () => {
			// The core of the bug: a member on a platform this instance knows
			// nothing about must not cost the room its other members.
			const resolved = await resolveParticipants(
				[ALICE, STRANGER, BOB],
				userService(),
				"test",
			);

			expect(resolved.map((u) => u.ename)).toEqual([ALICE, BOB]);
		});

		it("does not throw on malformed entries", async () => {
			// Each of these crashed `ref.split("(")[1].split(")")[0]`.
			const resolved = await resolveParticipants(
				[ALICE, null, 42, "", { nested: true }, [], undefined, BOB],
				userService(),
				"test",
			);

			expect(resolved.map((u) => u.ename)).toEqual([ALICE, BOB]);
		});

		it("rejects legacy envelope-id references instead of resolving them", async () => {
			const svc = userService();
			const resolved = await resolveParticipants(
				["users(local-alice)", "local-alice", ALICE],
				svc,
				"test",
			);

			expect(resolved.map((u) => u.ename)).toEqual([ALICE]);
			expect(svc.findById).not.toHaveBeenCalled();
		});

		it("returns an empty list for a non-array participants field", async () => {
			for (const refs of [undefined, null, "", 7, { a: 1 }]) {
				await expect(
					resolveParticipants(refs, userService(), "test"),
				).resolves.toEqual([]);
			}
		});

		it("survives a lookup that throws", async () => {
			const svc = {
				findByEname: vi.fn(async (ename: string) => {
					if (ename === ALICE) throw new Error("db down");
					return user(BOB, "bob");
				}),
			} as unknown as UserService;

			const resolved = await resolveParticipants([ALICE, BOB], svc, "test");
			expect(resolved.map((u) => u.ename)).toEqual([BOB]);
		});
	});

	describe("resolveEntityRef", () => {
		it("attributes a message to the sender named by eName", async () => {
			const sender = await resolveEntityRef(BOB, userService(), "test");
			expect(sender?.ename).toBe(BOB);
		});

		it("returns null rather than throwing for an unusable sender", async () => {
			for (const ref of [null, undefined, "", 42, {}, "users(local-alice)"]) {
				await expect(
					resolveEntityRef(ref, userService(), "test"),
				).resolves.toBeNull();
			}
		});

		it("returns null for an eName nobody local answers to", async () => {
			await expect(
				resolveEntityRef(STRANGER, userService(), "test"),
			).resolves.toBeNull();
		});
	});
});
