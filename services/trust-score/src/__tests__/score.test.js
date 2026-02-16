const { calculateTrustScore, getConnectionScore } = require("../score");

// ---------------------------------------------------------------------------
// Connection score buckets
// ---------------------------------------------------------------------------
describe("getConnectionScore", () => {
    test.each([
        [0, 0],
        [5, 0],
        [9, 0],
        [10, 0.5],
        [24, 0.5],
        [25, 1],
        [99, 1],
        [100, 2],
        [249, 2],
        [250, 3],
        [499, 3],
        [500, 4],
        [1000, 4],
    ])("%i connections → %s points", (connections, expected) => {
        expect(getConnectionScore(connections)).toBe(expected);
    });
});

// ---------------------------------------------------------------------------
// Full trust score
// ---------------------------------------------------------------------------
describe("calculateTrustScore", () => {
    test("unverified user with no attributes → 0", () => {
        const { score } = calculateTrustScore({
            isVerified: false,
            accountAgeDays: 0,
            keyLocation: "SW",
            thirdDegreeConnections: 0,
        });
        expect(score).toBe(0);
    });

    test("defaults produce score 0", () => {
        const { score } = calculateTrustScore({});
        expect(score).toBe(0);
    });

    test("account age > 180 days → +1", () => {
        const { score, breakdown } = calculateTrustScore({
            accountAgeDays: 181,
        });
        expect(breakdown.accountAge).toBe(1);
        expect(score).toBe(1);
    });

    test("account age exactly 180 → no bonus", () => {
        const { breakdown } = calculateTrustScore({
            accountAgeDays: 180,
        });
        expect(breakdown.accountAge).toBe(0);
    });

    test("key location TPM → +1", () => {
        const { score, breakdown } = calculateTrustScore({
            keyLocation: "TPM",
        });
        expect(breakdown.keyLocation).toBe(1);
        expect(score).toBe(1);
    });

    test("key location SW → +0", () => {
        const { breakdown } = calculateTrustScore({
            keyLocation: "SW",
        });
        expect(breakdown.keyLocation).toBe(0);
    });

    test("KYC verified → +4", () => {
        const { score, breakdown } = calculateTrustScore({
            isVerified: true,
        });
        expect(breakdown.verification).toBe(4);
        expect(score).toBe(4);
    });

    test("max non-KYC score = 6", () => {
        const { score } = calculateTrustScore({
            isVerified: false,
            accountAgeDays: 365,
            keyLocation: "TPM",
            thirdDegreeConnections: 1000,
        });
        expect(score).toBe(6);
    });

    test("max possible score = 10", () => {
        const { score } = calculateTrustScore({
            isVerified: true,
            accountAgeDays: 365,
            keyLocation: "TPM",
            thirdDegreeConnections: 1000,
        });
        expect(score).toBe(10);
    });

    test("score never exceeds 10", () => {
        const { score } = calculateTrustScore({
            isVerified: true,
            accountAgeDays: 9999,
            keyLocation: "TPM",
            thirdDegreeConnections: 99999,
        });
        expect(score).toBeLessThanOrEqual(10);
    });

    test("KYC user always scores higher than identical non-KYC user", () => {
        const profiles = [
            { accountAgeDays: 0, keyLocation: "SW", thirdDegreeConnections: 0 },
            {
                accountAgeDays: 200,
                keyLocation: "TPM",
                thirdDegreeConnections: 50,
            },
            {
                accountAgeDays: 365,
                keyLocation: "TPM",
                thirdDegreeConnections: 1000,
            },
        ];

        for (const profile of profiles) {
            const nonKyc = calculateTrustScore({
                ...profile,
                isVerified: false,
            });
            const kyc = calculateTrustScore({ ...profile, isVerified: true });
            expect(kyc.score).toBeGreaterThan(nonKyc.score);
        }
    });

    test("breakdown sums to score", () => {
        const { score, breakdown } = calculateTrustScore({
            isVerified: true,
            accountAgeDays: 200,
            keyLocation: "TPM",
            thirdDegreeConnections: 300,
        });
        const sum =
            breakdown.verification +
            breakdown.accountAge +
            breakdown.keyLocation +
            breakdown.socialConnections;
        expect(score).toBe(sum);
    });

    test("half-point connection score (15 connections)", () => {
        const { score, breakdown } = calculateTrustScore({
            thirdDegreeConnections: 15,
        });
        expect(breakdown.socialConnections).toBe(0.5);
        expect(score).toBe(0.5);
    });
});
