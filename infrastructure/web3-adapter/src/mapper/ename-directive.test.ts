import { describe, expect, it } from "vitest";
import type { MappingDatabase } from "../db";
import { fromGlobal, toGlobal } from "./mapper";
import type { IMapping } from "./mapper.types";

/**
 * The `__ename()` paths never consult the mapping store — that is the whole
 * point of them, since an eName is resolvable without a local id mapping — so a
 * store that throws on use doubles as an assertion that it is never touched.
 */
const mappingStore = new Proxy({} as MappingDatabase, {
	get(_target, prop) {
		throw new Error(
			`__ename() must not consult the mapping store (called ${String(prop)})`,
		);
	},
});

const ALICE = "@48468c9a-dc1b-5663-92fb-5e46e3d2a7f0";
const BOB = "@7f3d2e1a-9b8c-4d5e-8f0a-1b2c3d4e5f60";

const chatMapping: IMapping = {
	tableName: "chats",
	schemaId: "550e8400-e29b-41d4-a716-446655440003",
	ownerEnamePath: "ename",
	localToUniversalMap: {
		name: "name",
		ename: "ename",
		participants: "__ename(participants[].ename),participantIds",
		admins: "__ename(admins[].ename),admins",
	},
};

const messageMapping: IMapping = {
	tableName: "messages",
	schemaId: "550e8400-e29b-41d4-a716-446655440004",
	ownerEnamePath: "ename",
	localToUniversalMap: {
		text: "content",
		sender: "__ename(sender.ename),senderId",
	},
};

describe("__ename mapping directive", () => {
	describe("toGlobal — producers emit eNames only", () => {
		it("emits participants and admins as @-prefixed eNames", async () => {
			const global = await toGlobal({
				data: {
					ename: "@group",
					name: "Standup",
					participants: [{ ename: ALICE }, { ename: BOB }],
					admins: [{ ename: ALICE }],
				},
				mapping: chatMapping,
				mappingStore,
			});

			expect(global.data.participantIds).toEqual([ALICE, BOB]);
			expect(global.data.admins).toEqual([ALICE]);
		});

		it("adds the @ prefix to a bare W3ID so the wire format is uniform", async () => {
			const global = await toGlobal({
				data: {
					ename: "@group",
					participants: [{ ename: ALICE.slice(1) }],
					admins: [],
				},
				mapping: chatMapping,
				mappingStore,
			});

			expect(global.data.participantIds).toEqual([ALICE]);
		});

		it("never emits a legacy table(uuid) reference", async () => {
			const global = await toGlobal({
				data: {
					ename: "@group",
					participants: [
						{ ename: "users(3f8c1e2d-0000-4444-8888-aaaabbbbcccc)" },
						{ ename: ALICE },
					],
					admins: [],
				},
				mapping: chatMapping,
				mappingStore,
			});

			// The envelope-id form is dropped rather than passed through: emitting
			// it would put a reference on the wire that no consumer accepts.
			expect(global.data.participantIds).toEqual([ALICE]);
		});

		it("drops unusable participant entries instead of emitting holes", async () => {
			const global = await toGlobal({
				data: {
					ename: "@group",
					participants: [
						{ ename: ALICE },
						{ ename: null },
						{ ename: "" },
						{ ename: 42 },
						{},
						{ ename: BOB },
					],
					admins: [],
				},
				mapping: chatMapping,
				mappingStore,
			});

			expect(global.data.participantIds).toEqual([ALICE, BOB]);
		});

		it("emits a message sender as a scalar eName", async () => {
			const global = await toGlobal({
				data: { ename: "@group", text: "hi", sender: { ename: ALICE } },
				mapping: messageMapping,
				mappingStore,
			});

			expect(global.data.senderId).toBe(ALICE);
		});
	});

	describe("fromGlobal — consumers accept eNames only", () => {
		it("hands back an eName participant list unchanged", async () => {
			const local = await fromGlobal({
				data: { ename: "@group", participantIds: [ALICE, BOB], admins: [ALICE] },
				mapping: chatMapping,
				mappingStore,
			});

			expect(local.data.participants).toEqual([ALICE, BOB]);
			expect(local.data.admins).toEqual([ALICE]);
		});

		it("survives a malformed participant list without throwing", async () => {
			// Every entry here crashed the old `ref.split("(")[1].split(")")[0]`
			// parsing, which took down the whole room with it.
			const local = await fromGlobal({
				data: {
					ename: "@group",
					participantIds: [ALICE, null, 42, "", { nested: true }, [], BOB],
					admins: [],
				},
				mapping: chatMapping,
				mappingStore,
			});

			expect(local.data.participants).toEqual([ALICE, BOB]);
		});

		it("rejects a legacy envelope-id reference rather than mangling it", async () => {
			const local = await fromGlobal({
				data: {
					ename: "@group",
					participantIds: [
						"users(3f8c1e2d-0000-4444-8888-aaaabbbbcccc)",
						"3f8c1e2d-0000-4444-8888-aaaabbbbcccc",
						ALICE,
					],
					admins: [],
				},
				mapping: chatMapping,
				mappingStore,
			});

			expect(local.data.participants).toEqual([ALICE]);
		});

		it("yields an empty list, not a throw, when participants is absent or scalar", async () => {
			for (const participantIds of [undefined, null, "", 7, { a: 1 }]) {
				const local = await fromGlobal({
					data: { ename: "@group", participantIds, admins: [] },
					mapping: chatMapping,
					mappingStore,
				});
				expect(local.data.participants).toEqual([]);
			}
		});

		it("resolves a message senderId to a single eName", async () => {
			const local = await fromGlobal({
				data: { ename: "@group", content: "hi", senderId: ALICE },
				mapping: messageMapping,
				mappingStore,
			});

			expect(local.data.sender).toBe(ALICE);
		});

		it("yields null for an unusable senderId so the caller can tell it apart", async () => {
			const local = await fromGlobal({
				data: { ename: "@group", content: "hi", senderId: "user(abc)" },
				mapping: messageMapping,
				mappingStore,
			});

			expect(local.data.sender).toBeNull();
		});
	});

	it("round-trips a chat through toGlobal and back", async () => {
		const global = await toGlobal({
			data: {
				ename: "@group",
				name: "Standup",
				participants: [{ ename: ALICE }, { ename: BOB }],
				admins: [{ ename: ALICE }],
			},
			mapping: chatMapping,
			mappingStore,
		});

		const local = await fromGlobal({
			data: global.data,
			mapping: chatMapping,
			mappingStore,
		});

		expect(local.data.participants).toEqual([ALICE, BOB]);
		expect(local.data.admins).toEqual([ALICE]);
	});
});
