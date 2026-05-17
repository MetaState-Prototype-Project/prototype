import { Router } from "express";
import { config } from "../config";
import { IngestService } from "../services/IngestService";
import type { AwarenessPayload } from "../types";

/**
 * POST /ingest - the single entry point evault-core POSTs every MetaEnvelope
 * change to. Authenticated by the shared `x-ingest-secret` header.
 */
export function ingestRouter(): Router {
    const router = Router();
    const service = new IngestService();

    router.post("/ingest", async (req, res) => {
        if (
            config.ingestSecret &&
            req.header("x-ingest-secret") !== config.ingestSecret
        ) {
            return res.status(401).json({ error: "invalid ingest secret" });
        }

        const body = req.body as AwarenessPayload;
        if (!body?.id || !body?.schemaId) {
            return res
                .status(400)
                .json({ error: "id and schemaId are required" });
        }

        try {
            const result = await service.ingest(body);
            console.log(
                `[ingest] id=${body.id} schemaId=${body.schemaId} w3id=${body.w3id ?? "<none>"} queued=${result.deliveriesQueued}`,
            );
            return res.json({ ok: true, ...result });
        } catch (err) {
            console.error("[ingest] failed:", err);
            return res.status(500).json({ error: "ingest failed" });
        }
    });

    return router;
}
