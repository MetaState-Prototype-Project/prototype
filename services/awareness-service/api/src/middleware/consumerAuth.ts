import type { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../database/data-source";
import { Consumer } from "../database/entities/Consumer";
import { ApiKeyService } from "../services/ApiKeyService";

const apiKeyService = new ApiKeyService();

/**
 * Authenticates a consumer by `Authorization: Bearer <api-key>`. Rejects unless
 * the key is valid and its consumer is approved. Sets `req.consumer`.
 */
export async function consumerAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ error: "missing API key" });
        return;
    }

    const apiKey = await apiKeyService.verify(header.slice(7).trim());
    if (!apiKey) {
        res.status(401).json({ error: "invalid API key" });
        return;
    }

    const consumer = await AppDataSource.getRepository(Consumer).findOne({
        where: { id: apiKey.consumerId },
    });
    if (!consumer || consumer.status !== "approved") {
        res.status(403).json({ error: "consumer not approved" });
        return;
    }

    req.consumer = consumer;
    next();
}
