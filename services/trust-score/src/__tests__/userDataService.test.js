/**
 * Tests for userDataService — mocks axios to avoid real HTTP calls,
 * then verifies the trust-data extraction logic against binding documents.
 */

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("axios", () => {
    const axiosMock = { get: mockGet, post: mockPost };
    axiosMock.default = axiosMock;
    return { default: axiosMock };
});

const {
    fetchVerificationStatus,
    fetchAccountAgeDays,
    fetchKeyLocation,
    fetchThirdDegreeConnections,
    fetchUserTrustData,
    fetchBindingDocuments,
    normalizeEName,
    clearPlatformToken,
} = require("../userDataService");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal binding-document edge for GraphQL responses. */
function makeEdge({ id = "doc-1", type, data = {}, signatures = [] }) {
    return {
        node: {
            id,
            parsed: {
                subject: "@test-user",
                type,
                data,
                signatures,
            },
        },
    };
}

function makeSig(signer, daysAgo = 0) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return { signer, signature: "0x...", timestamp: d.toISOString() };
}

/** Set up axios mocks so registry + GraphQL calls succeed with `edges`. */
function mockEvault(edges) {
    // resolveEVaultUrl
    mockGet.mockResolvedValue({ data: { evaultUrl: "http://evault:4000" } });
    // getPlatformToken + GraphQL query
    mockPost.mockImplementation((url) => {
        if (url.includes("/platforms/certification")) {
            return Promise.resolve({ data: { token: "mock-token" } });
        }
        // GraphQL query
        return Promise.resolve({
            data: {
                data: {
                    bindingDocuments: { edges },
                },
            },
        });
    });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    clearPlatformToken();
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// normalizeEName
// ---------------------------------------------------------------------------

describe("normalizeEName", () => {
    test("prefixes @ when missing", () => {
        expect(normalizeEName("alice")).toBe("@alice");
    });
    test("leaves @ if already present", () => {
        expect(normalizeEName("@alice")).toBe("@alice");
    });
});

// ---------------------------------------------------------------------------
// fetchBindingDocuments
// ---------------------------------------------------------------------------

describe("fetchBindingDocuments", () => {
    test("returns parsed documents from GraphQL response", async () => {
        const edges = [
            makeEdge({ type: "id_document", data: { vendor: "veriff" } }),
            makeEdge({ id: "doc-2", type: "social_connection", signatures: [makeSig("@a"), makeSig("@b")] }),
        ];
        mockEvault(edges);

        const docs = await fetchBindingDocuments("test-user");
        expect(docs).toHaveLength(2);
        expect(docs[0].type).toBe("id_document");
        expect(docs[1].type).toBe("social_connection");
    });

    test("filters out malformed documents", async () => {
        const edges = [
            { node: { id: "bad", parsed: null } },
            { node: { id: "bad2", parsed: { subject: "@x" } } }, // missing type, data, signatures
            makeEdge({ type: "self" }),
        ];
        mockEvault(edges);

        const docs = await fetchBindingDocuments("test-user");
        expect(docs).toHaveLength(1);
        expect(docs[0].type).toBe("self");
    });
});

// ---------------------------------------------------------------------------
// fetchVerificationStatus
// ---------------------------------------------------------------------------

describe("fetchVerificationStatus", () => {
    test("returns true when id_document exists", async () => {
        mockEvault([makeEdge({ type: "id_document" })]);
        expect(await fetchVerificationStatus("test-user")).toBe(true);
    });

    test("returns false when no id_document exists", async () => {
        mockEvault([makeEdge({ type: "social_connection" })]);
        expect(await fetchVerificationStatus("test-user")).toBe(false);
    });

    test("returns false when eVault is empty", async () => {
        mockEvault([]);
        expect(await fetchVerificationStatus("test-user")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// fetchAccountAgeDays
// ---------------------------------------------------------------------------

describe("fetchAccountAgeDays", () => {
    test("returns 0 when no documents exist", async () => {
        mockEvault([]);
        expect(await fetchAccountAgeDays("test-user")).toBe(0);
    });

    test("computes days from earliest signature", async () => {
        const edges = [
            makeEdge({
                type: "self",
                signatures: [makeSig("@test-user", 200)],
            }),
            makeEdge({
                id: "doc-2",
                type: "id_document",
                signatures: [makeSig("@verifier", 100)],
            }),
        ];
        mockEvault(edges);

        const days = await fetchAccountAgeDays("test-user");
        // Earliest is 200 days ago
        expect(days).toBeGreaterThanOrEqual(199);
        expect(days).toBeLessThanOrEqual(201);
    });
});

// ---------------------------------------------------------------------------
// fetchKeyLocation
// ---------------------------------------------------------------------------

describe("fetchKeyLocation", () => {
    test("returns TPM when binding document has keyLocation=TPM", async () => {
        mockEvault([makeEdge({ type: "self", data: { keyLocation: "TPM" } })]);
        expect(await fetchKeyLocation("test-user")).toBe("TPM");
    });

    test("returns SW when no key location info exists", async () => {
        mockEvault([makeEdge({ type: "self", data: {} })]);
        expect(await fetchKeyLocation("test-user")).toBe("SW");
    });

    test("falls back to data.location field", async () => {
        mockEvault([makeEdge({ type: "self", data: { location: "TPM" } })]);
        expect(await fetchKeyLocation("test-user")).toBe("TPM");
    });
});

// ---------------------------------------------------------------------------
// fetchThirdDegreeConnections
// ---------------------------------------------------------------------------

describe("fetchThirdDegreeConnections", () => {
    test("counts social_connection docs with 2 signatures", async () => {
        const edges = [
            makeEdge({
                id: "sc1",
                type: "social_connection",
                signatures: [makeSig("@a"), makeSig("@b")],
            }),
            makeEdge({
                id: "sc2",
                type: "social_connection",
                signatures: [makeSig("@a"), makeSig("@c")],
            }),
            // Only 1 signature — not counted
            makeEdge({
                id: "sc3",
                type: "social_connection",
                signatures: [makeSig("@a")],
            }),
            // Not a social_connection
            makeEdge({ id: "other", type: "id_document" }),
        ];
        mockEvault(edges);

        expect(await fetchThirdDegreeConnections("test-user")).toBe(2);
    });

    test("returns 0 when no social connections", async () => {
        mockEvault([]);
        expect(await fetchThirdDegreeConnections("test-user")).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// fetchUserTrustData (aggregated, single GraphQL call)
// ---------------------------------------------------------------------------

describe("fetchUserTrustData", () => {
    test("returns all required fields with correct types", async () => {
        mockEvault([]);
        const data = await fetchUserTrustData("test-user");

        expect(typeof data.isVerified).toBe("boolean");
        expect(typeof data.accountAgeDays).toBe("number");
        expect(["TPM", "SW"]).toContain(data.keyLocation);
        expect(typeof data.thirdDegreeConnections).toBe("number");
    });

    test("derives all inputs from a realistic eVault", async () => {
        const edges = [
            makeEdge({
                id: "id1",
                type: "id_document",
                data: { vendor: "veriff" },
                signatures: [makeSig("@test-user", 365)],
            }),
            makeEdge({
                id: "key1",
                type: "self",
                data: { keyLocation: "TPM" },
                signatures: [makeSig("@test-user", 365)],
            }),
            makeEdge({
                id: "sc1",
                type: "social_connection",
                signatures: [makeSig("@test-user", 200), makeSig("@alice", 200)],
            }),
            makeEdge({
                id: "sc2",
                type: "social_connection",
                signatures: [makeSig("@test-user", 100), makeSig("@bob", 100)],
            }),
        ];
        mockEvault(edges);

        const data = await fetchUserTrustData("test-user");
        expect(data.isVerified).toBe(true);
        expect(data.accountAgeDays).toBeGreaterThanOrEqual(364);
        expect(data.keyLocation).toBe("TPM");
        expect(data.thirdDegreeConnections).toBe(2);
    });

    test("returned data is compatible with calculateTrustScore", async () => {
        mockEvault([
            makeEdge({
                id: "id1",
                type: "id_document",
                signatures: [makeSig("@test-user", 200)],
            }),
        ]);

        const { calculateTrustScore } = require("../score");
        const data = await fetchUserTrustData("test-user");
        const result = calculateTrustScore(data);

        expect(result).toHaveProperty("score");
        expect(result).toHaveProperty("breakdown");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(10);
    });
});
