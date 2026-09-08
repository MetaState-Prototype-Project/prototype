import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MappingDatabase } from "../db";
import { fromGlobal, toGlobal } from "./mapper";
import type { IMapping } from "./mapper.types";

/**
 * Exercises the mapping files the platforms actually ship, rather than fixtures
 * written to match the implementation.
 *
 * The bug this guards against is a producer and a consumer disagreeing about
 * the shape of an entity reference: chats replicated correctly and were then
 * dropped on ingest with no error. That disagreement is invisible to a test
 * that only ever looks at one side, or at a mapping written for the test.
 */

const REPO = join(__dirname, "../../../..");

const CHAT_SCHEMA = "550e8400-e29b-41d4-a716-446655440003";
const MESSAGE_SCHEMA = "550e8400-e29b-41d4-a716-446655440004";

const ALICE = "@48468c9a-dc1b-5663-92fb-5e46e3d2a7f0";
const BOB = "@7f3d2e1a-9b8c-4d5e-8f0a-1b2c3d4e5f60";

/** Every shipped chat/group and message mapping, by platform. */
const MAPPINGS: { platform: string; path: string }[] = [
	{ platform: "pictique", path: "platforms/pictique/api" },
	{ platform: "blabsy", path: "platforms/blabsy/api" },
	{ platform: "ereputation", path: "platforms/ereputation/api" },
	{ platform: "esigner", path: "platforms/esigner/api" },
	{ platform: "file-manager", path: "platforms/file-manager/api" },
	{ platform: "ecurrency", path: "platforms/ecurrency/api" },
	{ platform: "dreamsync", path: "platforms/dreamsync/api" },
	{ platform: "evoting", path: "platforms/evoting/api" },
	{ platform: "group-charter-manager", path: "platforms/group-charter-manager/api" },
	{ platform: "cerberus", path: "platforms/cerberus/client" },
];

function loadMappings(dir: string): IMapping[] {
	const base = join(REPO, dir, "src/web3adapter/mappings");
	const out: IMapping[] = [];
	for (const file of ["chat.mapping.json", "group.mapping.json", "message.mapping.json"]) {
		try {
			out.push(JSON.parse(readFileSync(join(base, file), "utf8")));
		} catch {
			// Not every platform ships every mapping.
		}
	}
	return out;
}

/** Fields that name people, and so must be eNames on the wire. */
const ENTITY_FIELDS = new Set([
	"participants",
	"admins",
	"members",
	"sender",
	"owner",
]);

/**
 * A store that returns nothing.
 *
 * Record relations (`charterSignatures`, `lastMessage`) legitimately consult
 * it, so it cannot simply throw. Entity references not needing it is asserted
 * separately: with a store that resolves nothing, a participant list that still
 * comes back intact cannot have been resolved through it.
 */
const emptyStore = {
	getLocalId: async () => null,
	getGlobalId: async () => null,
} as unknown as MappingDatabase;

describe("shipped chat mappings", () => {
	const chatLike = MAPPINGS.flatMap(({ platform, path }) =>
		loadMappings(path)
			.filter((m) => m.schemaId === CHAT_SCHEMA || m.schemaId === MESSAGE_SCHEMA)
			.map((mapping) => ({ platform, mapping })),
	);

	it("finds a chat or message mapping for every platform", () => {
		expect(chatLike.length).toBeGreaterThanOrEqual(MAPPINGS.length);
	});

	it.each(chatLike)(
		"$platform/$mapping.tableName declares every entity reference with __ename()",
		({ mapping }) => {
			for (const [local, global] of Object.entries(
				mapping.localToUniversalMap,
			)) {
				if (!ENTITY_FIELDS.has(local)) continue;

				// A `table(path)` reference here would be an envelope-id
				// reference, which is exactly what this change removes.
				expect(
					global.startsWith("__ename("),
					`${mapping.tableName}.${local} is "${global}", expected __ename(...)`,
				).toBe(true);
			}
		},
	);

	it.each(chatLike.filter((c) => c.mapping.schemaId === CHAT_SCHEMA))(
		"$platform round-trips an eName participant list without resolving ids",
		async ({ mapping }) => {
			const participantsPath = mapping.localToUniversalMap.participants;
			// Build a local record shaped the way this platform's path expects.
			const usesRelation = participantsPath.includes("[].ename");
			const local = {
				ename: "@group",
				participants: usesRelation
					? [{ ename: ALICE }, { ename: BOB }]
					: [ALICE, BOB],
			};

			const global = await toGlobal({
				data: local,
				mapping,
				mappingStore: emptyStore,
			});

			expect(global.data.participantIds).toEqual([ALICE, BOB]);

			const back = await fromGlobal({
				data: global.data as Record<string, unknown>,
				mapping,
				mappingStore: emptyStore,
			});

			expect(back.data.participants).toEqual([ALICE, BOB]);
		},
	);

	it.each(chatLike.filter((c) => c.mapping.schemaId === CHAT_SCHEMA))(
		"$platform ingests a malformed participant list without throwing",
		async ({ mapping }) => {
			const back = await fromGlobal({
				data: {
					ename: "@group",
					participantIds: [ALICE, null, 42, "", { nested: true }, [], BOB],
				},
				mapping,
				mappingStore: emptyStore,
			});

			expect(back.data.participants).toEqual([ALICE, BOB]);
		},
	);

	it.each(chatLike.filter((c) => c.mapping.schemaId === MESSAGE_SCHEMA))(
		"$platform attributes a message to the eName in senderId",
		async ({ mapping }) => {
			const senderKey = Object.entries(mapping.localToUniversalMap).find(
				([local]) => local === "sender" || local === "senderId",
			)?.[0];
			if (!senderKey) return;

			const back = await fromGlobal({
				data: { senderId: ALICE, content: "hi" },
				mapping,
				mappingStore: {
					getLocalId: async () => null,
				} as unknown as MappingDatabase,
			});

			expect(back.data[senderKey]).toBe(ALICE);
		},
	);
});
