const {
    fetchVerificationStatus,
    fetchAccountAgeDays,
    fetchKeyLocation,
    fetchThirdDegreeConnections,
    fetchUserTrustData,
} = require("../userDataService");

// ---------------------------------------------------------------------------
// Individual fetch functions (currently mocked)
// ---------------------------------------------------------------------------
describe("fetchVerificationStatus", () => {
    test("returns a boolean", async () => {
        const result = await fetchVerificationStatus("test-user");
        expect(typeof result).toBe("boolean");
    });

    test("mock returns false (unverified by default)", async () => {
        const result = await fetchVerificationStatus("test-user");
        expect(result).toBe(false);
    });
});

describe("fetchAccountAgeDays", () => {
    test("returns a number", async () => {
        const result = await fetchAccountAgeDays("test-user");
        expect(typeof result).toBe("number");
    });

    test("returns a non-negative value", async () => {
        const result = await fetchAccountAgeDays("test-user");
        expect(result).toBeGreaterThanOrEqual(0);
    });
});

describe("fetchKeyLocation", () => {
    test('returns "TPM" or "SW"', async () => {
        const result = await fetchKeyLocation("test-user");
        expect(["TPM", "SW"]).toContain(result);
    });
});

describe("fetchThirdDegreeConnections", () => {
    test("returns a number", async () => {
        const result = await fetchThirdDegreeConnections("test-user");
        expect(typeof result).toBe("number");
    });

    test("returns a non-negative value", async () => {
        const result = await fetchThirdDegreeConnections("test-user");
        expect(result).toBeGreaterThanOrEqual(0);
    });
});

// ---------------------------------------------------------------------------
// Aggregated fetch
// ---------------------------------------------------------------------------
describe("fetchUserTrustData", () => {
    test("returns all required fields", async () => {
        const data = await fetchUserTrustData("test-user");

        expect(data).toHaveProperty("isVerified");
        expect(data).toHaveProperty("accountAgeDays");
        expect(data).toHaveProperty("keyLocation");
        expect(data).toHaveProperty("thirdDegreeConnections");
    });

    test("returned data has correct types", async () => {
        const data = await fetchUserTrustData("test-user");

        expect(typeof data.isVerified).toBe("boolean");
        expect(typeof data.accountAgeDays).toBe("number");
        expect(["TPM", "SW"]).toContain(data.keyLocation);
        expect(typeof data.thirdDegreeConnections).toBe("number");
    });

    test("returned data is compatible with calculateTrustScore", async () => {
        const { calculateTrustScore } = require("../score");
        const data = await fetchUserTrustData("test-user");

        // Should not throw — the shape matches what calculateTrustScore expects
        const result = calculateTrustScore(data);

        expect(result).toHaveProperty("score");
        expect(result).toHaveProperty("breakdown");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(10);
    });
});
