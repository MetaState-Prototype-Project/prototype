import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MappingDatabase } from "../db";
import { enrichGroupOwnership } from "../w3ds/group-ownership";
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
	{
		platform: "group-charter-manager",
		path: "platforms/group-charter-manager/api",
	},
	{ platform: "cerberus", path: "platforms/cerberus/client" },
];

function loadMappings(dir: string): IMapping[] {
	const base = join(REPO, dir, "src/web3adapter/mappings");
	const out: IMapping[] = [];
	for (const file of [
		"chat.mapping.json",
		"group.mapping.json",
		"message.mapping.json",
	]) {
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
			.filter(
				(m) => m.schemaId === CHAT_SCHEMA || m.schemaId === MESSAGE_SCHEMA,
			)
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

	/**
	 * The full producer path, per platform: a local record shaped the way that
	 * platform's entity actually stores each field, run through the ownership
	 * enrichment and then the shipped mapping.
	 *
	 * This is the check that matters, because the platforms disagree about the
	 * shape of `admins` — a `User[]` relation on most, bare local ids on
	 * cerberus and group-charter-manager — and a mapping that reads
	 * `admins[].ename` emits an empty list if the producer hands it strings.
	 * Testing `participants` alone hides that entirely.
	 */
	it.each(chatLike.filter((c) => c.mapping.schemaId === CHAT_SCHEMA))(
		"$platform emits every entity field as eNames from its own local shape",
		async ({ mapping }) => {
			const map = mapping.localToUniversalMap;
			// Blabsy keys its user documents by eName, so its local records
			// already hold eNames where other platforms hold local ids.
			const keysAreEnames = mapping.tableName === "chat";

			// Build each field the way this platform's mapping says it is stored.
			// A `[].ename` path means a relation; a bare `[]` means a list of
			// scalars, which on Blabsy are already eNames (user documents are
			// keyed by eName) and elsewhere are local ids.
			const scalars = keysAreEnames
				? [ALICE, BOB]
				: ["local-alice", "local-bob"];
			const shaped = (spec: string | undefined) =>
				spec?.includes("[].ename")
					? [
							{ id: "local-alice", ename: ALICE },
							{ id: "local-bob", ename: BOB },
						]
					: scalars;

			const local: Record<string, unknown> = { ename: "@group" };
			if (map.owner) local.owner = keysAreEnames ? ALICE : "local-alice";
			if (map.participants) local.participants = shaped(map.participants);
			if (map.admins) local.admins = shaped(map.admins);
			if (map.members) local.members = shaped(map.members);

			const enriched = await enrichGroupOwnership(local, async (id) =>
				id === "local-alice" ? ALICE : id === "local-bob" ? BOB : null,
			);

			const global = await toGlobal({
				data: enriched,
				mapping,
				mappingStore: emptyStore,
			});

			// Whatever each field is called globally, it must hold eNames and
			// must not be empty when the local record named someone.
			for (const [local_, spec] of Object.entries(map)) {
				if (!ENTITY_FIELDS.has(local_)) continue;
				const target = spec.includes(",") ? spec.split(",")[1] : local_;
				const emitted = (global.data as Record<string, unknown>)[target];

				if (local_ === "owner") {
					expect(emitted, `${mapping.tableName}.owner`).toBe(ALICE);
					continue;
				}

				expect(
					emitted,
					`${mapping.tableName}.${local_} -> ${target} emitted nothing`,
				).toEqual([ALICE, BOB]);
			}
		},
	);

	it.each(chatLike.filter((c) => c.mapping.schemaId === MESSAGE_SCHEMA))(
		"$platform emits a message sender as an eName from its own local shape",
		async ({ mapping }) => {
			const map = mapping.localToUniversalMap;
			const senderSpec = map.sender ?? map.senderId;
			if (!senderSpec) return;

			// `sender.ename` means a relation; a bare `senderId` is a scalar,
			// which on Blabsy is already an eName.
			const local: Record<string, unknown> = { ename: "@group" };
			if (senderSpec.includes("sender.ename")) {
				local.sender = { id: "local-alice", ename: ALICE };
			} else {
				local.senderId = ALICE;
			}

			const global = await toGlobal({
				data: local,
				mapping,
				mappingStore: emptyStore,
			});

			expect(
				(global.data as Record<string, unknown>).senderId,
				`${mapping.tableName} senderId`,
			).toBe(ALICE);
		},
	);
});
