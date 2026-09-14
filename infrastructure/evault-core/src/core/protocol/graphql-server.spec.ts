import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as jose from "jose";
import {
    setupE2ETestServer,
    teardownE2ETestServer,
    provisionTestEVault,
    makeGraphQLRequest,
    type E2ETestServer,
    type ProvisionedEVault,
} from "../../test-utils/e2e-setup";
import { getSharedTestKeyPair } from "../../test-utils/shared-test-keys";
import { AwarenessOutboxDispatcher } from "../awareness/awareness-outbox-dispatcher";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import type { AddressInfo } from "node:net";

interface OutboxPayload {
    eventId: string;
    packetId: string;
    w3id: string;
    schemaId: string;
    data: Record<string, unknown> | null;
    operation: string;
    requestingPlatform: string | null;
    streamVersion: number;
    status: string;
}

async function outboxPayloads(server: E2ETestServer): Promise<OutboxPayload[]> {
    const session = server.neo4jDriver.session();
    try {
        const result = await session.run(
            "MATCH (a:AwarenessOutbox) RETURN a ORDER BY a.createdAt",
        );
        return result.records.map((record) => {
            const p = record.get("a").properties;
            return {
                eventId: p.eventId,
                packetId: p.packetId,
                w3id: p.w3id,
                schemaId: p.schemaId,
                data: JSON.parse(p.dataJson),
                operation: p.operation,
                requestingPlatform: p.requestingPlatform ?? null,
                streamVersion: p.streamVersion.toNumber(),
                status: p.status,
            };
        });
    } finally {
        await session.close();
    }
}

async function availablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const socket = createNetServer();
        socket.once("error", reject);
        socket.listen(0, "127.0.0.1", () => {
            const port = (socket.address() as AddressInfo).port;
            socket.close((error) => (error ? reject(error) : resolve(port)));
        });
    });
}

async function waitFor(
    predicate: () => Promise<boolean>,
    timeoutMs = 5_000,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("condition not reached before timeout");
}

describe("GraphQL transactional awareness outbox", () => {
    let server: E2ETestServer;
    let evault1: ProvisionedEVault;
    let evault2: ProvisionedEVault;

    beforeAll(async () => {
        server = await setupE2ETestServer();
        evault1 = await provisionTestEVault(server);
        evault2 = await provisionTestEVault(server);
    }, 120000);

    afterAll(async () => teardownE2ETestServer(server));

    beforeEach(async () => {
        const session = server.neo4jDriver.session();
        try {
            await session.run("MATCH (a:AwarenessOutbox) DETACH DELETE a");
        } finally {
            await session.close();
        }
    });

    it("atomically records the owner's W3ID and payload on create", async () => {
        const data = { field: "value", test: "store-test" };
        const result = await makeGraphQLRequest(
            server,
            `mutation Store($input: MetaEnvelopeInput!) {
                storeMetaEnvelope(input: $input) { metaEnvelope { id ontology } }
            }`,
            { input: { ontology: "OutboxCreate", payload: data, acl: ["*"] } },
            { "X-ENAME": evault1.w3id },
        );

        const events = await outboxPayloads(server);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            packetId: result.storeMetaEnvelope.metaEnvelope.id,
            w3id: evault1.w3id,
            schemaId: "OutboxCreate",
            data,
            operation: "create",
            streamVersion: 1,
            status: "pending",
        });
        expect(events[0].eventId).toBeTruthy();
    });

    it("keeps events for different owners distinct", async () => {
        const mutation = `mutation Store($input: MetaEnvelopeInput!) {
            storeMetaEnvelope(input: $input) { metaEnvelope { id } }
        }`;
        await makeGraphQLRequest(
            server,
            mutation,
            {
                input: {
                    ontology: "OutboxOwner",
                    payload: { user: 1 },
                    acl: ["*"],
                },
            },
            { "X-ENAME": evault1.w3id },
        );
        await makeGraphQLRequest(
            server,
            mutation,
            {
                input: {
                    ontology: "OutboxOwner",
                    payload: { user: 2 },
                    acl: ["*"],
                },
            },
            { "X-ENAME": evault2.w3id },
        );

        const events = await outboxPayloads(server);
        expect(events.map((event) => event.w3id)).toEqual([
            evault1.w3id,
            evault2.w3id,
        ]);
        expect(new Set(events.map((event) => event.eventId)).size).toBe(2);
    });

    it("records ordered full-state updates and origin metadata", async () => {
        const create = await makeGraphQLRequest(
            server,
            `mutation Store($input: MetaEnvelopeInput!) {
                storeMetaEnvelope(input: $input) { metaEnvelope { id } }
            }`,
            {
                input: {
                    ontology: "OutboxUpdate",
                    payload: { field: "initial", preserved: true },
                    acl: ["*"],
                },
            },
            { "X-ENAME": evault1.w3id },
        );
        const id = create.storeMetaEnvelope.metaEnvelope.id;
        const { privateKey } = await getSharedTestKeyPair();
        const platform = "http://localhost:3000";
        const token = await new jose.SignJWT({ platform })
            .setProtectedHeader({ alg: "ES256", kid: "entropy-key-1" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(privateKey);

        await makeGraphQLRequest(
            server,
            `mutation Update($id: String!, $input: MetaEnvelopeInput!) {
                updateMetaEnvelopeById(id: $id, input: $input) { metaEnvelope { id } }
            }`,
            {
                id,
                input: {
                    ontology: "OutboxUpdate",
                    payload: { field: "updated" },
                    acl: ["*"],
                },
            },
            { "X-ENAME": evault1.w3id, Authorization: `Bearer ${token}` },
        );

        const events = await outboxPayloads(server);
        expect(events).toHaveLength(2);
        expect(events[1]).toMatchObject({
            packetId: id,
            operation: "update",
            streamVersion: 2,
            requestingPlatform: platform,
            data: { field: "updated", preserved: true },
        });
    });

    it("records a delete tombstone and keeps stream versions monotonic after recreation", async () => {
        const create = await makeGraphQLRequest(
            server,
            `mutation Store($input: MetaEnvelopeInput!) {
                storeMetaEnvelope(input: $input) { metaEnvelope { id } }
            }`,
            {
                input: {
                    ontology: "OutboxDelete",
                    payload: { value: "gone" },
                    acl: ["*"],
                },
            },
            { "X-ENAME": evault1.w3id },
        );
        const id = create.storeMetaEnvelope.metaEnvelope.id;
        const { privateKey } = await getSharedTestKeyPair();
        const token = await new jose.SignJWT({
            platform: "http://localhost:3000",
        })
            .setProtectedHeader({ alg: "ES256", kid: "entropy-key-1" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(privateKey);
        await makeGraphQLRequest(
            server,
            `mutation Delete($id: String!) { deleteMetaEnvelope(id: $id) }`,
            { id },
            {
                "X-ENAME": evault1.w3id,
                Authorization: `Bearer ${token}`,
            },
        );

        const events = await outboxPayloads(server);
        expect(events.at(-1)).toMatchObject({
            packetId: id,
            schemaId: "OutboxDelete",
            operation: "delete",
            data: null,
            streamVersion: 2,
        });

        const recreate = await makeGraphQLRequest(
            server,
            `mutation Recreate($inputs: [BulkMetaEnvelopeInput!]!) {
                bulkCreateMetaEnvelopes(inputs: $inputs) {
                    successCount
                }
            }`,
            {
                inputs: [
                    {
                        id,
                        ontology: "OutboxDelete",
                        payload: { value: "back" },
                        acl: ["*"],
                    },
                ],
            },
            {
                "X-ENAME": evault1.w3id,
                Authorization: `Bearer ${token}`,
            },
        );
        expect(recreate.bulkCreateMetaEnvelopes.successCount).toBe(1);
        expect((await outboxPayloads(server)).at(-1)).toMatchObject({
            packetId: id,
            operation: "create",
            data: { value: "back" },
            streamVersion: 3,
        });
    });

    it("resumes a failed outbox event after dispatcher restart", async () => {
        await makeGraphQLRequest(
            server,
            `mutation Store($input: MetaEnvelopeInput!) {
                storeMetaEnvelope(input: $input) { metaEnvelope { id } }
            }`,
            {
                input: {
                    ontology: "OutboxRestart",
                    payload: { durable: true },
                    acl: ["*"],
                },
            },
            { "X-ENAME": evault1.w3id },
        );

        const port = await availablePort();
        const previousUrl = process.env.AWARENESS_SERVICE_URL;
        const previousPollMs = process.env.AWARENESS_OUTBOX_POLL_MS;
        process.env.AWARENESS_SERVICE_URL = `http://127.0.0.1:${port}`;
        process.env.AWARENESS_OUTBOX_POLL_MS = "20";

        let received: Record<string, unknown> | null = null;
        let first: AwarenessOutboxDispatcher | undefined;
        let second: AwarenessOutboxDispatcher | undefined;
        let inlet: ReturnType<typeof createServer> | undefined;
        try {
            first = new AwarenessOutboxDispatcher(server.neo4jDriver);
            first.start();
            await waitFor(async () => {
                const event = (await outboxPayloads(server))[0];
                return event?.status === "failed";
            });
            await first.stop();
            first = undefined;

            inlet = createServer((request, response) => {
                const chunks: Buffer[] = [];
                request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
                request.on("end", () => {
                    received = JSON.parse(
                        Buffer.concat(chunks).toString("utf8"),
                    );
                    response.writeHead(200, {
                        "content-type": "application/json",
                    });
                    response.end('{"ok":true}');
                });
            });
            await new Promise<void>((resolve) =>
                inlet!.listen(port, "127.0.0.1", () => resolve()),
            );

            second = new AwarenessOutboxDispatcher(server.neo4jDriver);
            second.start();
            await waitFor(async () => {
                const event = (await outboxPayloads(server))[0];
                return event?.status === "delivered";
            });

            expect(received).toMatchObject({
                eventId: expect.any(String),
                schemaId: "OutboxRestart",
                data: { durable: true },
                streamVersion: 1,
            });
        } finally {
            await first?.stop();
            await second?.stop();
            if (inlet?.listening) {
                await new Promise<void>((resolve) =>
                    inlet!.close(() => resolve()),
                );
            }
            if (previousUrl === undefined) {
                delete process.env.AWARENESS_SERVICE_URL;
            } else {
                process.env.AWARENESS_SERVICE_URL = previousUrl;
            }
            if (previousPollMs === undefined) {
                delete process.env.AWARENESS_OUTBOX_POLL_MS;
            } else {
                process.env.AWARENESS_OUTBOX_POLL_MS = previousPollMs;
            }
        }
    });
});
