/**
 * User Data Service
 *
 * Fetches all trust-score inputs for a given user (by eName / W3ID)
 * from their eVault binding documents.
 *
 * Flow (mirrors platforms/enotary):
 *   1. Resolve eName → eVault URL via the registry
 *   2. Obtain a platform bearer token from the registry
 *   3. Query the eVault GraphQL API for binding documents
 *   4. Derive verification status, account age, key location,
 *      and social-connection count from the returned documents
 */

const axios = require("axios");

let REGISTRY_URL =
    process.env.REGISTRY_URL ||
    process.env.PUBLIC_REGISTRY_URL ||
    "http://localhost:4321";

function setRegistryUrl(url) {
    REGISTRY_URL = url;
    // Clear cached token since it belongs to the old registry
    _platformToken = null;
}

const BINDING_DOCUMENTS_QUERY = `
    query GetBindingDocuments($first: Int!) {
        bindingDocuments(first: $first) {
            edges {
                node {
                    id
                    parsed
                }
            }
        }
    }
`;

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------

let _platformToken = null;

function normalizeEName(value) {
    return value.startsWith("@") ? value : `@${value}`;
}

/**
 * Resolve an eName to its eVault base URL via the registry.
 */
async function resolveEVaultUrl(eName) {
    const normalized = normalizeEName(eName);
    const endpoint = new URL(
        `/resolve?w3id=${encodeURIComponent(normalized)}`,
        REGISTRY_URL,
    ).toString();

    const response = await axios.get(endpoint, { timeout: 10_000 });
    const resolved = response.data?.evaultUrl || response.data?.uri;
    if (!resolved) {
        throw new Error(`Registry did not return an eVault URL for ${normalized}`);
    }
    return resolved;
}

/**
 * Obtain a platform bearer token from the registry.
 */
async function getPlatformToken() {
    if (_platformToken) return _platformToken;

    const endpoint = new URL("/platforms/certification", REGISTRY_URL).toString();
    const response = await axios.post(
        endpoint,
        { platform: "trust-score" },
        { timeout: 10_000 },
    );
    _platformToken = response.data.token;
    return _platformToken;
}

/** Reset cached token (useful when a token expires). */
function clearPlatformToken() {
    _platformToken = null;
}

// ---------------------------------------------------------------------------
// eVault GraphQL helper
// ---------------------------------------------------------------------------

/**
 * Fetch all binding documents from a user's eVault.
 *
 * @param {string} eName
 * @returns {Promise<Array<{ id: string, subject: string, type: string, data: object, signatures: Array }>>}
 */
async function fetchBindingDocuments(eName) {
    const normalized = normalizeEName(eName);
    const [evaultBaseUrl, token] = await Promise.all([
        resolveEVaultUrl(normalized),
        getPlatformToken(),
    ]);

    const graphqlUrl = new URL("/graphql", evaultBaseUrl).toString();

    const response = await axios.post(
        graphqlUrl,
        { query: BINDING_DOCUMENTS_QUERY, variables: { first: 100 } },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "X-ENAME": normalized,
            },
            timeout: 10_000,
        },
    );

    const edges = response.data?.data?.bindingDocuments?.edges ?? [];

    return edges
        .map((edge) => {
            const parsed = edge.node?.parsed;
            if (!parsed || typeof parsed !== "object") return null;
            const { subject, type, data, signatures } = parsed;
            if (
                typeof subject !== "string" ||
                typeof type !== "string" ||
                typeof data !== "object" ||
                data === null ||
                !Array.isArray(signatures)
            ) {
                return null;
            }
            return { id: edge.node.id, subject, type, data, signatures };
        })
        .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Individual trust-data extractors
// ---------------------------------------------------------------------------

/**
 * Is the user KYC-verified?
 * True when at least one `id_document` binding document exists.
 */
async function fetchVerificationStatus(eName) {
    const docs = await fetchBindingDocuments(eName);
    return docs.some((doc) => doc.type === "id_document");
}

/**
 * Account age in days.
 * Derived from the earliest signature timestamp across all binding documents.
 */
async function fetchAccountAgeDays(eName) {
    const docs = await fetchBindingDocuments(eName);

    let earliest = Infinity;
    for (const doc of docs) {
        for (const sig of doc.signatures) {
            const ts = new Date(sig.timestamp).getTime();
            if (!isNaN(ts) && ts < earliest) {
                earliest = ts;
            }
        }
    }

    if (earliest === Infinity) return 0;
    return Math.floor((Date.now() - earliest) / (1000 * 60 * 60 * 24));
}

/**
 * Key storage location ("TPM" or "SW").
 * Looks for a binding document whose data contains a `keyLocation` field.
 */
async function fetchKeyLocation(eName) {
    const docs = await fetchBindingDocuments(eName);

    for (const doc of docs) {
        const loc = doc.data?.keyLocation || doc.data?.location;
        if (loc === "TPM" || loc === "SW") return loc;
    }
    return "SW";
}

/**
 * Number of social connections (1st-degree).
 * Counts `social_connection` binding documents that have two signatures
 * (i.e. both parties signed).
 */
async function fetchThirdDegreeConnections(eName) {
    const docs = await fetchBindingDocuments(eName);
    return docs.filter(
        (doc) => doc.type === "social_connection" && doc.signatures.length === 2,
    ).length;
}

/**
 * Fetch all trust-score inputs for a user in a single pass
 * (one GraphQL call instead of four).
 */
async function fetchUserTrustData(eName) {
    const docs = await fetchBindingDocuments(eName);

    // Verification — at least one id_document
    const isVerified = docs.some((doc) => doc.type === "id_document");

    // Account age — earliest signature timestamp
    let earliest = Infinity;
    for (const doc of docs) {
        for (const sig of doc.signatures) {
            const ts = new Date(sig.timestamp).getTime();
            if (!isNaN(ts) && ts < earliest) {
                earliest = ts;
            }
        }
    }
    const accountAgeDays =
        earliest === Infinity
            ? 0
            : Math.floor((Date.now() - earliest) / (1000 * 60 * 60 * 24));

    // Key location
    let keyLocation = "SW";
    for (const doc of docs) {
        const loc = doc.data?.keyLocation || doc.data?.location;
        if (loc === "TPM" || loc === "SW") {
            keyLocation = loc;
            break;
        }
    }

    // Social connections
    const thirdDegreeConnections = docs.filter(
        (doc) => doc.type === "social_connection" && doc.signatures.length === 2,
    ).length;

    return { isVerified, accountAgeDays, keyLocation, thirdDegreeConnections };
}

module.exports = {
    fetchVerificationStatus,
    fetchAccountAgeDays,
    fetchKeyLocation,
    fetchThirdDegreeConnections,
    fetchUserTrustData,
    setRegistryUrl,
    // Exposed for testing
    fetchBindingDocuments,
    resolveEVaultUrl,
    getPlatformToken,
    clearPlatformToken,
    normalizeEName,
};
