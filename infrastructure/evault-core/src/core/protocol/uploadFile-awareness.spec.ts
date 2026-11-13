import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import * as jose from "jose";
import {
    makeGraphQLRequest,
    provisionTestEVault,
    setupE2ETestServer,
    teardownE2ETestServer,
    type E2ETestServer,
    type ProvisionedEVault,
} from "../../test-utils/e2e-setup";
import { getSharedTestKeyPair } from "../../test-utils/shared-test-keys";
import { FILE_SCHEMA_ID } from "../utils/w3ds-uri";

process.env.DO_SPACES_ENDPOINT = "https://ams3.digitaloceanspaces.com";
process.env.DO_SPACES_REGION = "ams3";
process.env.DO_SPACES_KEY = "test-key";
process.env.DO_SPACES_SECRET = "test-secret";
process.env.DO_SPACES_BUCKET = "test-bucket";

const { s3Send } = vi.hoisted(() => ({ s3Send: vi.fn() }));
vi.mock("@aws-sdk/client-s3", () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: s3Send })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
    DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

const UPLOAD_FILE = `mutation Upload($input: UploadFileInput!) {
    uploadFile(input: $input) {
        uri metaEnvelopeId publicUrl errors { field message code }
    }
}`;
const TEST_PLATFORM = "http://localhost:3000";

async function outboxEvents(server: E2ETestServer) {
    const session = server.neo4jDriver.session();
    try {
        const result = await session.run(
            "MATCH (a:AwarenessOutbox) RETURN a ORDER BY a.createdAt",
        );
        return result.records.map((record) => {
            const p = record.get("a").properties;
            return { ...p, data: JSON.parse(p.dataJson) };
        });
    } finally {
        await session.close();
    }
}

describe("uploadFile transactional awareness outbox", () => {
    let server: E2ETestServer;
    let evault: ProvisionedEVault;
    let authHeaders: Record<string, string>;

    beforeAll(async () => {
        server = await setupE2ETestServer();
        evault = await provisionTestEVault(server);
        const { privateKey } = await getSharedTestKeyPair();
        const token = await new jose.SignJWT({ platform: TEST_PLATFORM })
            .setProtectedHeader({ alg: "ES256", kid: "entropy-key-1" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(privateKey);
        authHeaders = {
            "X-ENAME": evault.w3id,
            Authorization: `Bearer ${token}`,
        };
    }, 120000);

    afterAll(async () => teardownE2ETestServer(server));

    beforeEach(async () => {
        vi.clearAllMocks();
        s3Send.mockResolvedValue({});
        const session = server.neo4jDriver.session();
        try {
            await session.run("MATCH (a:AwarenessOutbox) DETACH DELETE a");
        } finally {
            await session.close();
        }
    });

    it("atomically records the stored w3ds-file-v1 payload", async () => {
        const body = "hello world";
        const result = await makeGraphQLRequest(
            server,
            UPLOAD_FILE,
            {
                input: {
                    filename: "greeting.txt",
                    contentType: "text/plain",
                    content: Buffer.from(body).toString("base64"),
                    acl: ["*"],
                },
            },
            authHeaders,
        );
        expect(result.uploadFile.errors ?? []).toEqual([]);

        const events = await outboxEvents(server);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            packetId: result.uploadFile.metaEnvelopeId,
            schemaId: FILE_SCHEMA_ID,
            w3id: evault.w3id,
            operation: "create",
            requestingPlatform: TEST_PLATFORM,
            status: "pending",
            data: {
                filename: "greeting.txt",
                contentType: "text/plain",
                size: Buffer.byteLength(body),
                blobKey: expect.stringContaining("greeting.txt"),
                publicUrl: result.uploadFile.publicUrl,
                uploadedAt: expect.any(String),
            },
        });
    });

    it("does not create an event when input validation rejects the upload", async () => {
        const result = await makeGraphQLRequest(
            server,
            UPLOAD_FILE,
            {
                input: {
                    filename: "bad.txt",
                    contentType: "text/plain",
                    content: "not!valid!base64",
                    acl: ["*"],
                },
            },
            authHeaders,
        );
        expect(result.uploadFile.errors?.[0]?.code).toBe("INVALID_CONTENT");
        expect(await outboxEvents(server)).toHaveLength(0);
    });

    it("does not create an event when object storage fails first", async () => {
        s3Send.mockRejectedValueOnce(new Error("spaces unavailable"));
        const result = await makeGraphQLRequest(
            server,
            UPLOAD_FILE,
            {
                input: {
                    filename: "failed.txt",
                    contentType: "text/plain",
                    content: Buffer.from("body").toString("base64"),
                    acl: ["*"],
                },
            },
            authHeaders,
        );
        expect(result.uploadFile.errors?.[0]?.code).toBe("UPLOAD_FAILED");
        expect(await outboxEvents(server)).toHaveLength(0);
    });
});
