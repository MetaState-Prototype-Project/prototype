import { describe, expect, it, vi } from "vitest";
import { Web3Adapter } from "../index";

/**
 * `handleChange` is the one point every producer path passes through: direct
 * entity writes, junction-table changes, debounced group webhooks, and backfill
 * scripts all funnel into it.
 *
 * Enriching entity references anywhere else — a watcher's `enrichEntity`, say —
 * only covers the paths that happen to call it. Several do not, and a group
 * reaching the mapper without enrichment silently emits a bare local id, which
 * no consumer accepts. So the enrichment belongs here, and this asserts it.
 */

const ALICE = "@48468c9a-dc1b-5663-92fb-5e46e3d2a7f0";

function makeAdapter() {
	const stored: { data: Record<string, unknown> }[] = [];

	const adapter = new Web3Adapter({
		schemasPath: `${__dirname}/../../../../platforms/ereputation/api/src/web3adapter/mappings`,
		dbPath: `/tmp/w3a-test-${Math.random().toString(36).slice(2)}`,
		registryUrl: "http://registry.invalid",
		platform: "http://platform.invalid",
		resolveEnameByUserId: async (id) => (id === "local-alice" ? ALICE : null),
	});

	// Keep the test off the network: record what would have been stored.
	adapter.evaultClient = {
		storeMetaEnvelope: vi.fn(async (env: { data: Record<string, unknown> }) => {
			stored.push(env);
			return "global-1";
		}),
		storeReference: vi.fn(async () => undefined),
		updateMetaEnvelopeById: vi.fn(async () => undefined),
	} as never;

	return { adapter, stored };
}

describe("handleChange emits eNames for group ownership", () => {
	it("rewrites a bare local owner id, on any producer path", async () => {
		const { adapter, stored } = makeAdapter();
		// Wait for the mappings to load off disk.
		await adapter.readPaths();

		await adapter.handleChange({
			tableName: "groups",
			data: {
				id: "group-1",
				ename: "@group",
				name: "Standup",
				// The shape a junction-table or debounced webhook hands over:
				// a plain entity snapshot, never passed through enrichEntity.
				owner: "local-alice",
				participants: [{ id: "local-alice", ename: ALICE }],
				admins: [{ id: "local-alice", ename: ALICE }],
			},
		});

		expect(stored).toHaveLength(1);
		expect(stored[0].data.owner).toBe(ALICE);
		expect(stored[0].data.participantIds).toEqual([ALICE]);
		expect(stored[0].data.admins).toEqual([ALICE]);
	});
});
