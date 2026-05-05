import { Router } from "express";
import { Brackets } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Packet } from "../database/entities/Packet";
import { consumerAuth } from "../middleware/consumerAuth";
import { decodeCursor, encodeCursor } from "../utils/cursor";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * GET /api/packets - polling query API. Approved consumers filter the awareness
 * packet history by ontology, eVault and time range, paged with an opaque
 * (receivedAt, id) cursor.
 */
export function queryRouter(): Router {
    const router = Router();

    router.get("/api/packets", consumerAuth, async (req, res) => {
        const ontologies = String(req.query.ontology ?? "")
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean);
        const evault =
            typeof req.query.evault === "string" ? req.query.evault : null;
        const from = req.query.from
            ? new Date(String(req.query.from))
            : null;
        const to = req.query.to ? new Date(String(req.query.to)) : null;

        let limit = parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10);
        if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
        limit = Math.min(limit, MAX_LIMIT);

        if (
            (from && Number.isNaN(from.getTime())) ||
            (to && Number.isNaN(to.getTime()))
        ) {
            return res
                .status(400)
                .json({ error: "from/to must be ISO timestamps" });
        }

        const qb = AppDataSource.getRepository(Packet)
            .createQueryBuilder("p")
            .orderBy("p.receivedAt", "ASC")
            .addOrderBy("p.id", "ASC")
            .take(limit + 1);

        if (ontologies.length > 0) {
            qb.andWhere("p.ontology IN (:...ontologies)", { ontologies });
        }
        if (evault) {
            qb.andWhere(
                "(p.w3id = :evault OR p.evaultPublicKey = :evault)",
                { evault },
            );
        }
        if (from) qb.andWhere("p.receivedAt >= :from", { from });
        if (to) qb.andWhere("p.receivedAt <= :to", { to });

        if (typeof req.query.cursor === "string" && req.query.cursor) {
            const cursor = decodeCursor(req.query.cursor);
            if (!cursor) {
                return res.status(400).json({ error: "invalid cursor" });
            }
            qb.andWhere(
                new Brackets((w) => {
                    w.where("p.receivedAt > :cReceived", {
                        cReceived: cursor.receivedAt,
                    }).orWhere(
                        "(p.receivedAt = :cReceived AND p.id > :cId)",
                        { cReceived: cursor.receivedAt, cId: cursor.id },
                    );
                }),
            );
        }

        const rows = await qb.getMany();
        const hasMore = rows.length > limit;
        const packets = hasMore ? rows.slice(0, limit) : rows;
        const last = packets[packets.length - 1];

        return res.json({
            packets,
            hasMore,
            nextCursor:
                hasMore && last
                    ? encodeCursor({
                          receivedAt: last.receivedAt.toISOString(),
                          id: last.id,
                      })
                    : null,
        });
    });

    return router;
}
