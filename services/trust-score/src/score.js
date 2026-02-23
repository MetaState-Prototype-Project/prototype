/**
 * Trust Score Calculator
 *
 * Deterministic scoring formula (0–10):
 *
 *   Component              | Points
 *   -----------------------|-------
 *   Unverified baseline    | 0
 *   Account age > 180 days | 1
 *   Key location = TPM     | 1  (SW = 0)
 *   3rd-degree connections  |
 *     < 10                 | 0
 *     10–24                | 0.5
 *     25–99                | 1
 *     100–249              | 2
 *     250–499              | 3
 *     500+                 | 4
 *   KYC / ID verified      | 4
 *
 *   Max possible = 1 + 1 + 4 + 4 = 10
 *
 * Acceptance criteria: a KYC-verified user always scores higher than an
 * otherwise-identical non-verified user (+4 from verification guarantees this).
 */

/**
 * @param {number} count  Number of 3rd-degree connections
 * @returns {number}      Connection component score
 */
function getConnectionScore(count) {
    if (count >= 500) return 4;
    if (count >= 250) return 3;
    if (count >= 100) return 2;
    if (count >= 25) return 1;
    if (count >= 10) return 0.5;
    return 0;
}

/**
 * Calculate the trust score for a user.
 *
 * @param {object}  params
 * @param {boolean} params.isVerified             Whether the user passed KYC / ID verification
 * @param {number}  params.accountAgeDays         Age of the account in days
 * @param {string}  params.keyLocation            "TPM" | "SW"
 * @param {number}  params.thirdDegreeConnections Number of 3rd-degree social connections
 * @returns {{ score: number, breakdown: object }}
 */
function calculateTrustScore({
    isVerified = false,
    accountAgeDays = 0,
    keyLocation = "SW",
    thirdDegreeConnections = 0,
}) {
    const verification = isVerified ? 4 : 0;
    const accountAge = accountAgeDays > 180 ? 1 : 0;
    const key = keyLocation === "TPM" ? 1 : 0;
    const socialConnections = getConnectionScore(thirdDegreeConnections);

    const score = Math.min(
        verification + accountAge + key + socialConnections,
        10,
    );

    return {
        score,
        breakdown: {
            verification,
            accountAge,
            keyLocation: key,
            socialConnections,
        },
    };
}

module.exports = { calculateTrustScore, getConnectionScore };
