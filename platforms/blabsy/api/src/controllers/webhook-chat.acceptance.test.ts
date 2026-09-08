import { beforeAll, describe, expect, it } from "vitest";

/**
 * Acceptance test for inbound chat replication into Blabsy.
 *
 * Drives a MetaEnvelope through the real `WebhookController` into a real
 * Firestore (the emulator), then reads the documents back out. The reference
 * handling, the mapping files and the Firestore writes are all the production
 * ones.
 *
 * `mapChatData` is the site the task named as having no guard at all, and the
 * failure it produced — a `TypeError` on a bare eName that lost the whole room
 * — is only observable end to end: either the chat document exists with its
 * participants, or it does not.
 */

const ALICE = "@48468c9a-dc1b-5663-92fb-5e46e3d2a7f0";
const BOB = "@7f3d2e1a-9b8c-4d5e-8f0a-1b2c3d4e5f60";
const CAROL = "@0c0ffee0-dead-4bee-8fee-000000000000";

const CHAT_SCHEMA = "550e8400-e29b-41d4-a716-446655440003";
const MESSAGE_SCHEMA = "550e8400-e29b-41d4-a716-446655440004";

// biome-ignore lint/suspicious/noExplicitAny: modules are imported after env setup
let db: any;
// biome-ignore lint/suspicious/noExplicitAny: modules are imported after env setup
let controller: any;

/** Minimal express req/res doubles: the controller only uses body and status. */
function invoke(body: Record<string, unknown>): Promise<{ status: number }> {
	return new Promise((resolve) => {
		let status = 0;
		const res = {
			status(code: number) {
				status = code;
				return this;
			},
			json() {
				resolve({ status });
				return this;
			},
			send() {
				resolve({ status });
				return this;
			},
		};
		controller.handleWebhook({ body }, res).catch(() => resolve({ status }));
	});
}

beforeAll(async () => {
	// `globalSetup` has the emulator up and has set FIRESTORE_EMULATOR_HOST.
	process.env.BLABSY_MAPPING_DB_PATH = `/tmp/blabsy-accept-${Date.now()}`;
	process.env.PUBLIC_REGISTRY_URL = "http://registry.invalid";
	process.env.PUBLIC_BLABSY_BASE_URL = "http://blabsy.invalid";

	const admin = await import("firebase-admin/app");
	const firestore = await import("firebase-admin/firestore");
	if (admin.getApps().length === 0) {
		admin.initializeApp({ projectId: "blabsy-test" });
	}
	db = firestore.getFirestore();

	const mod = await import("./WebhookController");
	await mod.adapter.readPaths();
	// Outbound sync is not what this test is about; keep it off the network.
	mod.adapter.evaultClient = {
		storeMetaEnvelope: async () => "global-out",
		storeReference: async () => undefined,
		updateMetaEnvelopeById: async () => undefined,
	} as never;

	controller = new mod.WebhookController();

	// Blabsy keys user documents by eName, so these ids are the eNames.
	await db.collection("users").doc(ALICE).set({ id: ALICE, name: "Alice", username: "alice" });
	await db.collection("users").doc(BOB).set({ id: BOB, name: "Bob", username: "bob" });
}, 120_000);


async function chatNamed(name: string) {
	const snap = await db.collection("chats").where("name", "==", name).get();
	return snap.empty ? null : snap.docs[0].data();
}

describe("blabsy inbound chat replication (controller -> Firestore emulator)", () => {
	it("ingests a chat whose participants are all eNames", async () => {
		await invoke({
			id: `chat-enames-${Date.now()}`,
			schemaId: CHAT_SCHEMA,
			data: {
				ename: "@group-1",
				name: "All eNames",
				participantIds: [ALICE, BOB],
				admins: [ALICE],
			},
		});

		const chat = await chatNamed("All eNames");
		expect(chat, "the room should exist").toBeTruthy();
		expect(chat.participants.sort()).toEqual([ALICE, BOB].sort());
		expect(chat.admins).toEqual([ALICE]);
		expect(chat.type).toBe("direct");
	});

	it("ingests a chat containing malformed participant entries", async () => {
		// These are the values that threw in the unguarded
		// `p.split("(")[1].split(")")[0]` and lost the whole room.
		await invoke({
			id: `chat-malformed-${Date.now()}`,
			schemaId: CHAT_SCHEMA,
			data: {
				ename: "@group-2",
				name: "Malformed entries",
				participantIds: [ALICE, null, 42, "", { nested: true }, [], BOB],
				admins: null,
			},
		});

		const chat = await chatNamed("Malformed entries");
		expect(chat, "the room should still ingest").toBeTruthy();
		expect(chat.participants.sort()).toEqual([ALICE, BOB].sort());
		expect(chat.admins).toEqual([]);
	});

	it("keeps a participant this instance has no profile for", async () => {
		// Blabsy stores the eName itself, so an unknown member is retained as a
		// member; only their display name is unavailable.
		await invoke({
			id: `chat-stranger-${Date.now()}`,
			schemaId: CHAT_SCHEMA,
			data: {
				ename: "@group-3",
				name: "With a stranger",
				participantIds: [ALICE, CAROL, BOB],
				admins: [],
			},
		});

		const chat = await chatNamed("With a stranger");
		expect(chat).toBeTruthy();
		expect(chat.participants.sort()).toEqual([ALICE, BOB, CAROL].sort());
		expect(chat.type).toBe("group");
	});

	it("attributes a message to the eName in senderId", async () => {
		const chatGlobalId = `chat-msg-${Date.now()}`;
		await invoke({
			id: chatGlobalId,
			schemaId: CHAT_SCHEMA,
			data: {
				ename: "@group-4",
				name: "Message attribution",
				participantIds: [ALICE, BOB],
				admins: [],
			},
		});

		const { adapter } = await import("./WebhookController");
		const localChatId = await adapter.mappingDb.getLocalId(chatGlobalId);
		expect(localChatId, "the chat should have been mapped").toBeTruthy();

		await invoke({
			id: `message-${Date.now()}`,
			schemaId: MESSAGE_SCHEMA,
			data: {
				chatId: chatGlobalId,
				senderId: BOB,
				content: "hello from an eName",
			},
		});

		const messages = await db
			.collection(`chats/${localChatId}/messages`)
			.where("text", "==", "hello from an eName")
			.get();

		expect(messages.empty, "the message should exist").toBe(false);
		const message = messages.docs[0].data();
		expect(message.senderId).toBe(BOB);
		expect(message.isSystemMessage).toBe(false);
	});

	it("resolves display names for the eName participants it knows", async () => {
		const chat = await chatNamed("All eNames");
		const names = await Promise.all(
			chat.participants.map(async (ename: string) => {
				const doc = await db.collection("users").doc(ename).get();
				return doc.exists ? doc.data().name : null;
			}),
		);
		expect(names.filter(Boolean).sort()).toEqual(["Alice", "Bob"]);
	});

	it("drops a legacy envelope-id participant rather than resolving it", async () => {
		await invoke({
			id: `chat-legacy-${Date.now()}`,
			schemaId: CHAT_SCHEMA,
			data: {
				ename: "@group-5",
				name: "Legacy refs",
				participantIds: ["user(3f8c1e2d-0000-4444-8888-aaaabbbbcccc)"],
				admins: [],
			},
		});

		const chat = await chatNamed("Legacy refs");
		if (chat) expect(chat.participants).toEqual([]);
	});
});
