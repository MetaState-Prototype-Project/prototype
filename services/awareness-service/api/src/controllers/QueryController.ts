import { Router } from "express";
import { Brackets, type SelectQueryBuilder } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Packet } from "../database/entities/Packet";
import { AwarenessEvent } from "../database/entities/AwarenessEvent";
import { consumerAuth } from "../middleware/consumerAuth";
import { decodeCursor, encodeCursor } from "../utils/cursor";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * GET /api/packets - polling query API. Approved consumers filter the awareness
 * packet history by ontology, eVault and time range, paged with an opaque
 * (receivedAt, id) cursor. The response also reports the total match count and
 * page count for the current filter.
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
        const from = req.query.from ? new Date(String(req.query.from)) : null;
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

        // Applies the ontology / eVault / time-range filters (everything
        // except the pagination cursor) to a fresh query builder.
        const withFilters = (): SelectQueryBuilder<AwarenessEvent> => {
            const qb =
                AppDataSource.getRepository(AwarenessEvent).createQueryBuilder(
                    "p",
                );
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
            return qb;
        };

        // Total number of packets matching the filter (cursor-independent).
        const total = await withFilters().getCount();

        // The current page: filters + cursor, ordered, one extra row to detect
        // whether more pages follow.
        const qb = withFilters()
            .orderBy("p.receivedAt", "ASC")
            .addOrderBy("p.eventId", "ASC")
            .take(limit + 1);

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
                        "(p.receivedAt = :cReceived AND p.eventId > :cId)",
                        { cReceived: cursor.receivedAt, cId: cursor.id },
                    );
                }),
            );
        }

        const rows = await qb.getMany();
        const hasMore = rows.length > limit;
        const events = hasMore ? rows.slice(0, limit) : rows;
        const packets = events.map((event) => ({
            eventId: event.eventId,
            id: event.packetId,
            ontology: event.ontology,
            evaultPublicKey: event.evaultPublicKey,
            w3id: event.w3id,
            data: event.data,
            operation: event.operation,
            streamVersion: event.streamVersion,
            occurredAt: event.occurredAt,
            receivedAt: event.receivedAt,
        }));
        const last = events[events.length - 1];

        return res.json({
            packets,
            count: packets.length,
            total,
            pageSize: limit,
            totalPages: Math.ceil(total / limit),
            hasMore,
            nextCursor:
                hasMore && last
                    ? encodeCursor({
                          receivedAt: last.receivedAt.toISOString(),
                          id: last.eventId,
                      })
                    : null,
        });
    });

    // GET /api/packets/:id - fetch a single awareness packet (MetaEnvelope) by
    // its id. Not consumer-scoped, mirroring the polling endpoint above.
    router.get("/api/packets/:id", consumerAuth, async (req, res) => {
        const packet = await AppDataSource.getRepository(Packet).findOne({
            where: { id: req.params.id },
        });
        if (!packet) return res.status(404).json({ error: "not found" });
        const latestEvent = await AppDataSource.getRepository(AwarenessEvent)
            .createQueryBuilder("e")
            .where("e.packetId = :packetId", { packetId: req.params.id })
            .orderBy("e.receivedAt", "DESC")
            .addOrderBy("e.eventId", "DESC")
            .getOne();
        return res.json({
            packet: {
                ...packet,
                eventId: latestEvent?.eventId ?? null,
                streamVersion: latestEvent?.streamVersion ?? null,
                occurredAt: latestEvent?.occurredAt ?? packet.receivedAt,
            },
        });
    });

    return router;
}
