import type { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../database/data-source";
import { Consumer } from "../database/entities/Consumer";
import { ApiKeyService } from "../services/ApiKeyService";
import { w3dsAuthService } from "../services/W3dsAuthService";

const apiKeyService = new ApiKeyService();

/**
 * Authenticates a consumer for the management + query API. Accepts either:
 *  - a machine API key (`aaas_...`) - used for polling and automation, or
 *  - a W3DS portal session JWT - used by the dashboard, resolved to the
 *    consumer that owns the logged-in eName.
 *
 * This dual mode lets a freshly approved consumer issue its first API key from
 * the portal (it has no key yet). Either way the consumer must be approved and
 * `req.consumer` is set.
 */
export async function consumerAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ error: "authentication required" });
        return;
    }
    const token = header.slice(7).trim();
    const consumerRepo = AppDataSource.getRepository(Consumer);

    let consumer: Consumer | null = null;

    if (token.startsWith("aaas_")) {
        const apiKey = await apiKeyService.verify(token);
        if (!apiKey) {
            res.status(401).json({ error: "invalid API key" });
            return;
        }
        consumer = await consumerRepo.findOne({
            where: { id: apiKey.consumerId },
        });
    } else {
        const decoded = w3dsAuthService.verifyToken(token);
        if (!decoded) {
            res.status(401).json({ error: "invalid session token" });
            return;
        }
        consumer = await consumerRepo.findOne({
            where: { ename: decoded.ename },
        });
    }

    if (!consumer || consumer.status !== "approved") {
        res.status(403).json({ error: "consumer not approved" });
        return;
    }

    req.consumer = consumer;
    next();
}
