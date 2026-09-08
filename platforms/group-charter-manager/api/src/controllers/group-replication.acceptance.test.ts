import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Acceptance test for group replication in group-charter-manager.
 *
 * This platform is the awkward one, and therefore the one worth driving end to
 * end. Its `participants` are a TypeORM relation, but `owner` and `admins` are
 * bare local user ids in plain columns with no relation for the mapping to
 * follow. Both directions have to work:
 *
 *  - inbound, an eName has to be resolved back to the local id the column holds
 *  - outbound, that local id has to leave as an eName
 *
 * The outbound half is the one unit tests kept missing, because a group reaches
 * `handleChange` from several call sites and only some pass through the
 * watcher's enrichment.
 */

const ALICE = "@48468c9a-dc1b-5663-92fb-5e46e3d2a7f0";
const BOB = "@7f3d2e1a-9b8c-4d5e-8f0a-1b2c3d4e5f60";
const STRANGER = "@0c0ffee0-dead-4bee-8fee-000000000000";

const GROUP_SCHEMA = "550e8400-e29b-41d4-a716-446655440003";

let container: StartedPostgreSqlContainer;
// biome-ignore lint/suspicious/noExplicitAny: modules are imported after env setup
let AppDataSource: any;
// biome-ignore lint/suspicious/noExplicitAny: modules are imported after env setup
let app: any;
// biome-ignore lint/suspicious/noExplicitAny: modules are imported after env setup
let User: any;
// biome-ignore lint/suspicious/noExplicitAny: modules are imported after env setup
let Group: any;
// biome-ignore lint/suspicious/noExplicitAny: modules are imported after env setup
let adapter: any;

/** Envelopes the adapter would have sent, captured instead of posted. */
const sent: { data: Record<string, unknown> }[] = [];

beforeAll(async () => {
	container = await new PostgreSqlContainer("postgres:15-alpine")
		.withDatabase("gcm_test")
		.withUsername("test")
		.withPassword("test")
		.start();

	process.env.GROUP_CHARTER_DATABASE_URL = container.getConnectionUri();
	process.env.GROUP_CHARTER_MAPPING_DB_PATH = `/tmp/gcm-accept-${Date.now()}`;
	process.env.PUBLIC_REGISTRY_URL = "http://registry.invalid";
	process.env.PUBLIC_GROUP_CHARTER_BASE_URL = "http://gcm.invalid";
	process.env.CHARTER_JWT_SECRET ??= "test-secret";

	const ds = await import("../database/data-source");
	AppDataSource = ds.AppDataSource;
	({ User } = await import("../database/entities/User"));
	({ Group } = await import("../database/entities/Group"));

	AppDataSource.setOptions({
		synchronize: true,
		subscribers: [],
		migrations: [],
	});
	await AppDataSource.initialize();
	await AppDataSource.synchronize();

	({ adapter } = await import("../web3adapter/watchers/subscriber"));
	await adapter.readPaths();
	adapter.evaultClient = {
		storeMetaEnvelope: async (env: { data: Record<string, unknown> }) => {
			sent.push(env);
			return `global-${sent.length}`;
		},
		storeReference: async () => undefined,
		updateMetaEnvelopeById: async (
			_id: string,
			env: { data: Record<string, unknown> },
		) => {
			sent.push(env);
		},
	};

	const { WebhookController } = await import("./WebhookController");
	const controller = new WebhookController(adapter);
	app = express();
	app.use(express.json());
	app.post("/api/webhook", controller.handleWebhook);

	const users = AppDataSource.getRepository(User);
	await users.save(users.create({ ename: ALICE, name: "Alice", handle: "alice" }));
	await users.save(users.create({ ename: BOB, name: "Bob", handle: "bob" }));
}, 180_000);

afterAll(async () => {
	if (AppDataSource?.isInitialized) await AppDataSource.destroy();
	await container?.stop();
}, 60_000);

describe("gcm group replication (real HTTP -> controller -> Postgres)", () => {
	it("ingests a group whose participants, admins and owner are eNames", async () => {
		await request(app)
			.post("/api/webhook")
			.send({
				id: `group-enames-${Date.now()}`,
				schemaId: GROUP_SCHEMA,
				w3id: ALICE,
				data: {
					ename: "@group-1",
					name: "All eNames",
					description: "d",
					participantIds: [ALICE, BOB],
					admins: [ALICE],
					owner: ALICE,
				},
			})
			.expect(200);

		const group = await AppDataSource.getRepository(Group).findOne({
			where: { name: "All eNames" },
			relations: ["participants"],
		});

		expect(group, "the group should exist").toBeTruthy();
		expect(
			group.participants.map((p: { ename: string }) => p.ename).sort(),
		).toEqual([ALICE, BOB].sort());

		// owner and admins are local id columns, so the eNames resolve back.
		const alice = await AppDataSource.getRepository(User).findOneBy({
			ename: ALICE,
		});
		expect(group.owner).toBe(alice.id);
		expect(group.admins).toEqual([alice.id]);
	});

	it("keeps the group when a participant, admin or owner is unresolvable", async () => {
		await request(app)
			.post("/api/webhook")
			.send({
				id: `group-stranger-${Date.now()}`,
				schemaId: GROUP_SCHEMA,
				w3id: ALICE,
				data: {
					ename: "@group-2",
					name: "With a stranger",
					description: "d",
					participantIds: [ALICE, STRANGER, BOB],
					admins: [STRANGER],
					owner: STRANGER,
				},
			})
			.expect(200);

		const group = await AppDataSource.getRepository(Group).findOne({
			where: { name: "With a stranger" },
			relations: ["participants"],
		});

		expect(group, "the group should survive").toBeTruthy();
		expect(
			group.participants.map((p: { ename: string }) => p.ename).sort(),
		).toEqual([ALICE, BOB].sort());
		// An unresolvable admin is skipped rather than stored as a dangling id.
		expect(group.admins ?? []).toEqual([]);
	});

	it("ingests a group with malformed entries without losing it", async () => {
		await request(app)
			.post("/api/webhook")
			.send({
				id: `group-malformed-${Date.now()}`,
				schemaId: GROUP_SCHEMA,
				w3id: ALICE,
				data: {
					ename: "@group-3",
					name: "Malformed entries",
					description: "d",
					participantIds: [ALICE, null, 42, "", { nested: true }, [], BOB],
					admins: [null, 7],
					owner: null,
				},
			})
			.expect(200);

		const group = await AppDataSource.getRepository(Group).findOne({
			where: { name: "Malformed entries" },
			relations: ["participants"],
		});

		expect(group, "the group should still ingest").toBeTruthy();
		expect(
			group.participants.map((p: { ename: string }) => p.ename).sort(),
		).toEqual([ALICE, BOB].sort());
	});

	it("emits eNames outbound, including for the bare-id owner and admins", async () => {
		// The producer half. `handleChange` is called directly here, the way a
		// junction-table change or a backfill script calls it — bypassing the
		// watcher's enrichment entirely.
		const users = AppDataSource.getRepository(User);
		const alice = await users.findOneBy({ ename: ALICE });
		const bob = await users.findOneBy({ ename: BOB });

		const groups = AppDataSource.getRepository(Group);
		const group = await groups.save(
			groups.create({
				name: "Outbound",
				description: "d",
				ename: "@group-out",
				owner: alice.id,
				admins: [alice.id, bob.id],
				participants: [alice, bob],
			}),
		);

		sent.length = 0;
		await adapter.handleChange({
			data: {
				...group,
				participants: [alice, bob],
			},
			tableName: "groups",
		});

		expect(sent.length, "an envelope should have been produced").toBe(1);
		const emitted = sent[0].data;

		expect(emitted.owner, "owner must leave as an eName").toBe(ALICE);
		expect(
			(emitted.admins as string[]).sort(),
			"admins must leave as eNames",
		).toEqual([ALICE, BOB].sort());
		expect((emitted.participantIds as string[]).sort()).toEqual(
			[ALICE, BOB].sort(),
		);

		// Nothing that looks like a local uuid should be on the wire.
		for (const value of [
			emitted.owner,
			...(emitted.admins as string[]),
			...(emitted.participantIds as string[]),
		]) {
			expect(String(value)).toMatch(/^@/);
			expect(String(value)).not.toContain(alice.id);
		}
	});
});
