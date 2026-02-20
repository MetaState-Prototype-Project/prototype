/**
 * User Data Service
 *
 * Responsible for fetching all the data inputs the trust score needs
 * for a given user (identified by their eName / W3ID).
 *
 * Currently MOCKED — each function returns placeholder data.
 * Once binding documents are written to the eVault, replace each mock
 * with a real API call.
 */

const EVAULT_CORE_URL = process.env.EVAULT_CORE_URL || "http://localhost:3001";
const EVAULT_DATA_URL = process.env.EVAULT_DATA_URL || "http://localhost:4000";

/**
 * Fetch the user's KYC verification status from evault-core.
 *
 * Real implementation will query:
 *   GET {EVAULT_CORE_URL}/verification?linkedEName={eName}
 *   → look at the `approved` field on the Verification entity
 *
 * @param {string} eName  The user's W3ID / eName
 * @returns {Promise<boolean>}
 */
async function fetchVerificationStatus(eName) {
    // TODO: Replace with real evault-core API call
    // const res = await fetch(`${EVAULT_CORE_URL}/verification?linkedEName=${eName}`);
    // const data = await res.json();
    // return data.approved === true;
    return false;
}

/**
 * Fetch the user's account age in days from evault-core.
 *
 * Real implementation will query:
 *   GET {EVAULT_CORE_URL}/verification?linkedEName={eName}
 *   → compute days since `createdAt`
 *
 * @param {string} eName  The user's W3ID / eName
 * @returns {Promise<number>}
 */
async function fetchAccountAgeDays(eName) {
    // TODO: Replace with real evault-core API call
    // const res = await fetch(`${EVAULT_CORE_URL}/verification?linkedEName=${eName}`);
    // const data = await res.json();
    // const created = new Date(data.createdAt);
    // return Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
    return 0;
}

/**
 * Fetch the user's key storage location from their eVault.
 *
 * Real implementation will query the eVault GraphQL API for a
 * binding document with ontology "KeyStorageInfo" that records
 * whether the private key is stored in TPM or SW.
 *
 * @param {string} eName  The user's W3ID / eName
 * @returns {Promise<"TPM" | "SW">}
 */
async function fetchKeyLocation(eName) {
    // TODO: Replace with real eVault GraphQL query
    // const query = `{ metaEnvelopes(filter: { ontology: "KeyStorageInfo" }) { envelopes { value } } }`;
    // const res = await fetch(`${EVAULT_DATA_URL}/graphql`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json', 'X-ENAME': eName },
    //     body: JSON.stringify({ query }),
    // });
    // const data = await res.json();
    // return data?.data?.metaEnvelopes?.[0]?.envelopes?.[0]?.value?.location ?? 'SW';
    return "SW";
}

/**
 * Fetch the user's number of 3rd-degree social connections.
 *
 * Real implementation will query the social graph (to be built
 * in the control panel) or aggregate follower/following data
 * from the user's eVault MetaEnvelopes across platforms.
 *
 * @param {string} eName  The user's W3ID / eName
 * @returns {Promise<number>}
 */
async function fetchThirdDegreeConnections(eName) {
    // TODO: Replace with real social graph API call
    // const res = await fetch(`${CONTROL_PANEL_URL}/api/social-graph/${eName}/third-degree-count`);
    // const data = await res.json();
    // return data.count;
    return 0;
}

/**
 * Fetch all trust score inputs for a user.
 *
 * @param {string} eName  The user's W3ID / eName
 * @returns {Promise<{ isVerified: boolean, accountAgeDays: number, keyLocation: string, thirdDegreeConnections: number }>}
 */
async function fetchUserTrustData(eName) {
    const [isVerified, accountAgeDays, keyLocation, thirdDegreeConnections] =
        await Promise.all([
            fetchVerificationStatus(eName),
            fetchAccountAgeDays(eName),
            fetchKeyLocation(eName),
            fetchThirdDegreeConnections(eName),
        ]);

    return { isVerified, accountAgeDays, keyLocation, thirdDegreeConnections };
}

module.exports = {
    fetchVerificationStatus,
    fetchAccountAgeDays,
    fetchKeyLocation,
    fetchThirdDegreeConnections,
    fetchUserTrustData,
};
