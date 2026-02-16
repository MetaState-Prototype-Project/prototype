const express = require("express");
const cors = require("cors");
const { calculateTrustScore } = require("./score");
const { fetchUserTrustData } = require("./userDataService");

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

/**
 * GET /trust-score/:eName
 *
 * Fetch all trust data for a user by their eName (W3ID) and return the score.
 * This is the primary endpoint — the caller only needs the user ID.
 *
 * Response:
 *   {
 *     "eName": string,
 *     "score": number,
 *     "breakdown": { verification, accountAge, keyLocation, socialConnections }
 *   }
 */
app.get("/trust-score/:eName", async (req, res) => {
    const { eName } = req.params;

    if (!eName || typeof eName !== "string") {
        return res.status(400).json({ error: "eName parameter is required" });
    }

    try {
        const userData = await fetchUserTrustData(eName);
        const result = calculateTrustScore(userData);
        return res.json({ eName, ...result });
    } catch (err) {
        console.error(`Error fetching trust data for ${eName}:`, err);
        return res
            .status(500)
            .json({ error: "Failed to fetch user trust data" });
    }
});

/**
 * POST /trust-score
 *
 * Body:
 *   {
 *     "isVerified": boolean,
 *     "accountAgeDays": number,
 *     "keyLocation": "TPM" | "SW",
 *     "thirdDegreeConnections": number
 *   }
 *
 * Response:
 *   {
 *     "score": number,
 *     "breakdown": { verification, accountAge, keyLocation, socialConnections }
 *   }
 */
app.post("/trust-score", (req, res) => {
    const { isVerified, accountAgeDays, keyLocation, thirdDegreeConnections } =
        req.body;

    // Basic validation
    if (
        keyLocation !== undefined &&
        keyLocation !== "TPM" &&
        keyLocation !== "SW"
    ) {
        return res
            .status(400)
            .json({ error: 'keyLocation must be "TPM" or "SW"' });
    }

    if (
        accountAgeDays !== undefined &&
        (typeof accountAgeDays !== "number" || accountAgeDays < 0)
    ) {
        return res
            .status(400)
            .json({ error: "accountAgeDays must be a non-negative number" });
    }

    if (
        thirdDegreeConnections !== undefined &&
        (typeof thirdDegreeConnections !== "number" ||
            thirdDegreeConnections < 0)
    ) {
        return res
            .status(400)
            .json({
                error: "thirdDegreeConnections must be a non-negative number",
            });
    }

    const result = calculateTrustScore({
        isVerified: !!isVerified,
        accountAgeDays: accountAgeDays ?? 0,
        keyLocation: keyLocation ?? "SW",
        thirdDegreeConnections: thirdDegreeConnections ?? 0,
    });

    return res.json(result);
});

/**
 * GET /trust-score  — convenience endpoint for quick testing
 *
 * Query params: isVerified, accountAgeDays, keyLocation, thirdDegreeConnections
 */
app.get("/trust-score", (req, res) => {
    const isVerified = req.query.isVerified === "true";
    const accountAgeDays = Number(req.query.accountAgeDays) || 0;
    const keyLocation = req.query.keyLocation || "SW";
    const thirdDegreeConnections =
        Number(req.query.thirdDegreeConnections) || 0;

    if (keyLocation !== "TPM" && keyLocation !== "SW") {
        return res
            .status(400)
            .json({ error: 'keyLocation must be "TPM" or "SW"' });
    }

    const result = calculateTrustScore({
        isVerified,
        accountAgeDays,
        keyLocation,
        thirdDegreeConnections,
    });

    return res.json(result);
});

app.listen(PORT, () => {
    console.log(`Trust Score service running on port ${PORT}`);
});

module.exports = app;
