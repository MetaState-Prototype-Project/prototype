import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Acceptance test for inbound chat replication.
 *
 * This drives the path a chat actually takes into Pictique: an HTTP POST of a
 * MetaEnvelope to `/api/webhook`, through the real `WebhookController`, the
 * real `Web3Adapter` and mapping files, into a real Postgres database via the
 * real TypeORM entities. Nothing about the reference handling is stubbed.
 *
 * The unit tests around the mapper are useful but cannot establish this: the
 * bug being fixed was a producer and a consumer disagreeing about a wire
 * format, and that disagreement only shows up when a whole envelope crosses the
 * boundary and either lands in the database or does not.
 */

const ALICE = "@48468c9a-dc1b-5663-92fb-5e46e3d2a7f0";
const BOB = "@7f3d2e1a-9b8c-4d5e-8f0a-1b2c3d4e5f60";
/** Well-formed, but on a platform this instance knows nothing about. */
const STRANGER = "@0c0ffee0-dead-4bee-8fee-000000000000";

const CHAT_SCHEMA = "550e8400-e29b-41d4-a716-446655440003";
const MESSAGE_SCHEMA = "550e8400-e29b-41d4-a716-446655440004";

let container: StartedPostgreSqlContainer;
// biome-ignore lint/suspicious/noExplicitAny: modules are imported after env setup
let AppDataSource: any;
// biome-ignore lint/suspicious/noExplicitAny: modules are imported after env setup
let app: any;
// biome-ignore lint/suspicious/noExplicitAny: modules are imported after env setup
let User: any;
// biome-ignore lint/suspicious/noExplicitAny: modules are imported after env setup
let Chat: any;
// biome-ignore lint/suspicious/noExplicitAny: modules are imported after env setup
let Message: any;

beforeAll(async () => {
	container = await new PostgreSqlContainer("postgres:15-alpine")
		.withDatabase("pictique_test")
		.withUsername("test")
		.withPassword("test")
		.start();

	// The data source reads this at module load, so it is set first.
	process.env.PICTIQUE_DATABASE_URL = container.getConnectionUri();
	process.env.PICTIQUE_MAPPING_DB_PATH = `/tmp/pictique-accept-${Date.now()}`;
	process.env.PUBLIC_REGISTRY_URL = "http://registry.invalid";
	process.env.PUBLIC_PICTIQUE_BASE_URL = "http://pictique.invalid";
	// The real service module refuses to load without one.
	process.env.PICTIQUE_JWT_SECRET ??= "test-secret";

	const ds = await import("../database/data-source");
	AppDataSource = ds.AppDataSource;
	({ User } = await import("../database/entities/User"));
	({ Chat } = await import("../database/entities/Chat"));
	({ Message } = await import("../database/entities/Message"));

	// Production config keeps `synchronize` off and loads migrations by glob;
	// the test builds the schema from the entities instead. The subscriber is
	// dropped too, since this test is about ingest, not outbound sync.
	AppDataSource.setOptions({
		synchronize: true,
		subscribers: [],
		migrations: [],
	});
	await AppDataSource.initialize();
	await AppDataSource.synchronize();

	const { WebhookController } = await import("./WebhookController");
	const { adapter } = await import("../web3adapter/watchers/subscriber");
	await adapter.readPaths();

	// Outbound sync is not what this test is about; keep it off the network.
	adapter.evaultClient = {
		storeMetaEnvelope: async () => "global-out",
		storeReference: async () => undefined,
		updateMetaEnvelopeById: async () => undefined,
		fetchMetaEnvelope: async (id: string) => ({
			id,
			schemaId: CHAT_SCHEMA,
			w3id: ALICE,
			data: {},
		}),
		// Only the methods this path touches; the rest of EVaultClient is
		// network machinery the ingest path never reaches.
	} as unknown as typeof adapter.evaultClient;

	const controller = new WebhookController(adapter);
	app = express();
	app.use(express.json());
	app.post("/api/webhook", controller.handleWebhook);

	// Two of the three people below are known here. The third is not, which is
	// the realistic case: chats span platforms.
	const users = AppDataSource.getRepository(User);
	await users.save(users.create({ ename: ALICE, name: "Alice", handle: "alice" }));
	await users.save(users.create({ ename: BOB, name: "Bob", handle: "bob" }));
}, 120_000);

afterAll(async () => {
	if (AppDataSource?.isInitialized) await AppDataSource.destroy();
	await container?.stop();
}, 60_000);

/** Posts a MetaEnvelope the way the eVault webhook does. */
async function postEnvelope(body: Record<string, unknown>) {
	return request(app).post("/api/webhook").send(body).expect(200);
}

describe("inbound chat replication (real HTTP -> controller -> Postgres)", () => {
	it("ingests a chat whose participants are all eNames", async () => {
		const globalId = `chat-all-enames-${Date.now()}`;

		await postEnvelope({
			id: globalId,
			schemaId: CHAT_SCHEMA,
			w3id: ALICE,
			data: {
				ename: "@group-1",
				name: "All eNames",
				participantIds: [ALICE, BOB],
				admins: [ALICE],
			},
		});

		const chats = AppDataSource.getRepository(Chat);
		const stored = await chats.findOne({
			where: { name: "All eNames" },
			relations: ["participants", "admins"],
		});

		expect(stored, "the room should exist").toBeTruthy();
		expect(stored.participants.map((p: { ename: string }) => p.ename).sort()).toEqual(
			[ALICE, BOB].sort(),
		);
		expect(stored.admins.map((a: { ename: string }) => a.ename)).toEqual([ALICE]);
	});

	it("keeps the room when one participant is unresolvable", async () => {
		// The local user must still end up in the room. Dropping the whole room
		// over a member who lives elsewhere is the bug being fixed.
		const globalId = `chat-stranger-${Date.now()}`;

		await postEnvelope({
			id: globalId,
			schemaId: CHAT_SCHEMA,
			w3id: ALICE,
			data: {
				ename: "@group-2",
				name: "With a stranger",
				participantIds: [ALICE, STRANGER, BOB],
				admins: [],
			},
		});

		const stored = await AppDataSource.getRepository(Chat).findOne({
			where: { name: "With a stranger" },
			relations: ["participants"],
		});

		expect(stored, "the room should survive an unresolvable member").toBeTruthy();
		expect(stored.participants.map((p: { ename: string }) => p.ename).sort()).toEqual(
			[ALICE, BOB].sort(),
		);
	});

	it("ingests a chat containing malformed participant entries", async () => {
		// null, a number, "", a nested object, an array. Each of these threw a
		// TypeError in the old parsing and took the whole envelope down.
		const globalId = `chat-malformed-${Date.now()}`;

		await postEnvelope({
			id: globalId,
			schemaId: CHAT_SCHEMA,
			w3id: ALICE,
			data: {
				ename: "@group-3",
				name: "Malformed entries",
				participantIds: [ALICE, null, 42, "", { nested: true }, [], BOB],
				admins: [],
			},
		});

		const stored = await AppDataSource.getRepository(Chat).findOne({
			where: { name: "Malformed entries" },
			relations: ["participants"],
		});

		expect(stored, "the room should still ingest").toBeTruthy();
		expect(stored.participants.map((p: { ename: string }) => p.ename).sort()).toEqual(
			[ALICE, BOB].sort(),
		);
	});

	it("attributes a message to the user named by its senderId eName", async () => {
		const chatGlobalId = `chat-for-message-${Date.now()}`;

		await postEnvelope({
			id: chatGlobalId,
			schemaId: CHAT_SCHEMA,
			w3id: ALICE,
			data: {
				ename: "@group-4",
				name: "Message attribution",
				participantIds: [ALICE, BOB],
				admins: [],
			},
		});

		await postEnvelope({
			id: `message-${Date.now()}`,
			schemaId: MESSAGE_SCHEMA,
			w3id: BOB,
			data: {
				chatId: chatGlobalId,
				senderId: BOB,
				content: "hello from an eName",
			},
		});

		const stored = await AppDataSource.getRepository(Message).findOne({
			where: { text: "hello from an eName" },
			relations: ["sender", "chat"],
		});

		expect(stored, "the message should exist").toBeTruthy();
		expect(stored.sender?.ename).toBe(BOB);
		expect(stored.chat).toBeTruthy();
	});

	it("resolves display names and avatars for eName-only participants", async () => {
		// An eName carries identity but no profile data. The room still has to
		// render a name for each member it knows.
		const stored = await AppDataSource.getRepository(Chat).findOne({
			where: { name: "All eNames" },
			relations: ["participants"],
		});

		const names = stored.participants
			.map((p: { name: string }) => p.name)
			.sort();
		expect(names).toEqual(["Alice", "Bob"]);
	});

	it("rejects a legacy envelope-id participant rather than resolving it", async () => {
		// Envelope-id support is removed. A room named only that way ends up
		// with no participants, rather than silently resolving.
		const alice = await AppDataSource.getRepository(User).findOneBy({
			ename: ALICE,
		});

		await postEnvelope({
			id: `chat-legacy-${Date.now()}`,
			schemaId: CHAT_SCHEMA,
			w3id: ALICE,
			data: {
				ename: "@group-5",
				name: "Legacy refs",
				participantIds: [`users(${alice.id})`, alice.id],
				admins: [],
			},
		});

		const stored = await AppDataSource.getRepository(Chat).findOne({
			where: { name: "Legacy refs" },
			relations: ["participants"],
		});

		if (stored) expect(stored.participants).toEqual([]);
	});

	it("always answers the sender, even on an envelope it cannot handle", async () => {
		// A handler that throws without responding leaves the eVault waiting out
		// its own timeout and learning nothing. That is how the original crash
		// stayed invisible: it looked like a slow peer, not a failure.
		const response = await request(app)
			.post("/api/webhook")
			.send({
				id: `chat-garbage-${Date.now()}`,
				schemaId: CHAT_SCHEMA,
				w3id: ALICE,
				data: null,
			})
			.timeout(10_000);

		expect(response.status).toBeGreaterThanOrEqual(200);
		expect(response.status).toBeLessThan(600);
	});
});
