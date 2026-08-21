import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import axios from "axios";
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
import { FILE_SCHEMA_ID } from "../utils/w3ds-uri";

// Keep a handle on the real axios.post: the spy below must still let the
// GraphQL requests through to the test server.
const originalAxiosPost = axios.post;

// evault-core forwards every awareness packet to AaaS at
// AWARENESS_SERVICE_URL/ingest; point it somewhere the spy can intercept.
process.env.AWARENESS_SERVICE_URL = "http://localhost:9999";

// StorageService.isConfigured() gates the uploadFile resolver, and its
// constructor throws without these. Set them before the module is imported.
process.env.DO_SPACES_ENDPOINT = "https://ams3.digitaloceanspaces.com";
process.env.DO_SPACES_REGION = "ams3";
process.env.DO_SPACES_KEY = "test-key";
process.env.DO_SPACES_SECRET = "test-secret";
process.env.DO_SPACES_BUCKET = "test-bucket";

// vi.mock is hoisted above every const in this module, so the shared spy has to
// be created inside vi.hoisted or the factory would hit it in the TDZ.
const { s3Send } = vi.hoisted(() => ({ s3Send: vi.fn() }));

// Stub the S3 transport so uploads never leave the process, while leaving
// StorageService itself real (buildKey and the public URL are what we assert).
vi.mock("@aws-sdk/client-s3", () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: s3Send })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
    DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

const UPLOAD_FILE = `
    mutation UploadFile($input: UploadFileInput!) {
        uploadFile(input: $input) {
            uri
            metaEnvelopeId
            publicUrl
            errors { field message code }
        }
    }
`;

// The platform claim the test Bearer token carries. evault-core passes it to
// AaaS as requestingPlatform so the packet is not delivered back to its origin.
const TEST_PLATFORM = "http://localhost:3000";

/** Every /ingest call the spy captured, in order. */
function ingestCalls() {
    return (axios.post as any).mock.calls.filter(
        (call: any[]) =>
            typeof call[0] === "string" && call[0].includes("/ingest"),
    );
}

/**
 * uploadFile used to be the only write mutation that never dispatched an
 * awareness packet, so uploaded blobs were invisible to AaaS. Consumers worked
 * around it by mirroring every upload as a second envelope under a different
 * ontology. These tests pin the dispatch in place.
 */
describe("uploadFile awareness ingest", () => {
    let server: E2ETestServer;
    let evault: ProvisionedEVault;
    let authHeaders: Record<string, string>;
    let axiosPostSpy: any;

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

    afterAll(async () => {
        await teardownE2ETestServer(server);
        if (axiosPostSpy) axiosPostSpy.mockRestore();
    });

    beforeEach(() => {
        if (axiosPostSpy) axiosPostSpy.mockRestore();
        vi.clearAllMocks();
        s3Send.mockResolvedValue({});

        axiosPostSpy = vi
            .spyOn(axios, "post")
            .mockImplementation((url: string | any, data?: any, config?: any) => {
                if (typeof url === "string" && url.includes("/ingest")) {
                    return Promise.resolve({
                        status: 200,
                        data: { ok: true },
                    }) as any;
                }
                return originalAxiosPost.call(axios, url, data, config);
            });
    });

    it("dispatches an ingest packet stamped w3ds-file-v1", async () => {
        const content = Buffer.from("hello world").toString("base64");

        const result = await makeGraphQLRequest(
            server,
            UPLOAD_FILE,
            {
                input: {
                    filename: "greeting.txt",
                    contentType: "text/plain",
                    content,
                    acl: ["*"],
                },
            },
            authHeaders,
        );

        expect(result.uploadFile.errors ?? []).toEqual([]);
        const metaEnvelopeId = result.uploadFile.metaEnvelopeId;
        expect(metaEnvelopeId).toBeTruthy();

        // notifyAwareness is fire-and-forget; give it a moment to run.
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const calls = ingestCalls();
        expect(calls.length).toBeGreaterThan(0);

        const payload = calls[0][1];
        expect(payload.schemaId).toBe(FILE_SCHEMA_ID);
        expect(payload.schemaId).toBe("w3ds-file-v1");
        expect(payload.w3id).toBe(evault.w3id);
        expect(payload.operation).toBe("create");
        // The packet id is the MetaEnvelope id, so a consumer can address the
        // blob as w3ds://file?id=<w3id>/<id> without another round trip.
        expect(payload.id).toBe(metaEnvelopeId);
        // Origin is forwarded so AaaS can skip delivering back to the uploader.
        expect(payload.requestingPlatform).toBe(TEST_PLATFORM);
    });

    it("sends the stored payload verbatim, including blobKey", async () => {
        const body = "second file";
        const content = Buffer.from(body).toString("base64");

        const result = await makeGraphQLRequest(
            server,
            UPLOAD_FILE,
            {
                input: {
                    filename: "notes.txt",
                    contentType: "text/plain",
                    content,
                    acl: ["*"],
                },
            },
            authHeaders,
        );

        const { metaEnvelopeId, publicUrl } = result.uploadFile;
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const payload = ingestCalls()[0][1];

        // Packet data must equal what a consumer reads back via
        // metaEnvelope(id) — any divergence is a trap for consumers that diff
        // the two, and would muddy the contentHash dedupe in AaaS.
        expect(payload.data).toEqual({
            filename: "notes.txt",
            contentType: "text/plain",
            size: Buffer.byteLength(body),
            blobKey: expect.stringContaining("notes.txt"),
            publicUrl,
            uploadedAt: expect.any(String),
        });

        const stored = await makeGraphQLRequest(
            server,
            `query Get($id: ID!) { metaEnvelope(id: $id) { id ontology parsed } }`,
            { id: metaEnvelopeId },
            authHeaders,
        );
        expect(stored.metaEnvelope.ontology).toBe(FILE_SCHEMA_ID);
        expect(stored.metaEnvelope.parsed).toEqual(payload.data);
    });

    it("does not dispatch when the upload is rejected", async () => {
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
        expect(result.uploadFile.metaEnvelopeId).toBeFalsy();

        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(ingestCalls()).toHaveLength(0);
    });

    it("does not dispatch when the object store write fails", async () => {
        s3Send.mockRejectedValueOnce(new Error("spaces unavailable"));

        const result = await makeGraphQLRequest(
            server,
            UPLOAD_FILE,
            {
                input: {
                    filename: "doomed.txt",
                    contentType: "text/plain",
                    content: Buffer.from("nope").toString("base64"),
                    acl: ["*"],
                },
            },
            authHeaders,
        );

        expect(result.uploadFile.errors?.[0]?.code).toBe("UPLOAD_FAILED");

        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(ingestCalls()).toHaveLength(0);
    });
});
