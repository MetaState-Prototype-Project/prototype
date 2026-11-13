import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { validate as uuidValidate } from "uuid";
import {
    type GlobalRateLimiter,
    parseTrustProxy,
} from "../core/http/global-rate-limiter";
import {
    type RateLimitConfigService,
    RuleValidationError,
} from "../services/RateLimitConfigService";

function digest(value: string): Buffer {
    return createHash("sha256").update(value).digest();
}

// Its own secret rather than PROVISIONER_SHARED_SECRET, which the wallet
// carries and is therefore public.
function requireAdminSecret(req: Request, res: Response): boolean {
    const secret = process.env.RATE_LIMIT_ADMIN_SECRET;
    if (!secret) {
        res.status(503).json({ error: "Rate limit admin API disabled" });
        return false;
    }
    const provided = req.headers["x-shared-secret"];
    if (
        typeof provided !== "string" ||
        !timingSafeEqual(digest(provided), digest(secret))
    ) {
        res.status(401).json({
            error: "Unauthorized: invalid or missing shared secret",
        });
        return false;
    }
    return true;
}

/**
 * Admin API for rate limit rules, served to the control panel. It lives on
 * the Express app, which the limiter does not cover, so no rule can lock an
 * admin out of removing it.
 */
export class RateLimitAdminController {
    constructor(
        private readonly config: RateLimitConfigService,
        private readonly limiter: GlobalRateLimiter,
    ) {}

    registerRoutes(app: any) {
        app.get("/admin/rate-limits", (req: Request, res: Response) => {
            if (!requireAdminSecret(req, res)) return;
            const snapshot = this.config.snapshot;
            res.json({
                windowSeconds: 60,
                config: {
                    source: snapshot.source,
                    loadedAt: snapshot.loadedAt,
                },
                trustProxy: parseTrustProxy(process.env.EVAULT_TRUST_PROXY),
                defaults: {
                    platform: snapshot.platformDefault,
                    ip: snapshot.ipDefault,
                },
                rules: snapshot.rules,
            });
        });

        app.get("/admin/rate-limits/usage", (req: Request, res: Response) => {
            if (!requireAdminSecret(req, res)) return;
            res.json(this.limiter.getUsage());
        });

        app.put(
            "/admin/rate-limits/rules",
            async (req: Request, res: Response) => {
                if (!requireAdminSecret(req, res)) return;
                try {
                    const rule = await this.config.upsert(req.body ?? {});
                    console.log(
                        `[rate-limit] ${rule.updatedBy ?? "unknown"} set ${rule.kind} ${rule.subject} to ${rule.mode}${rule.mode === "limit" ? ` ${rule.limitPerMinute}/min` : ""}`,
                    );
                    res.json({ rule });
                } catch (error) {
                    if (error instanceof RuleValidationError) {
                        return res
                            .status(400)
                            .json({ error: error.message, field: error.field });
                    }
                    console.error("[rate-limit] could not save rule:", error);
                    res.status(500).json({ error: "Could not save the rule" });
                }
            },
        );

        app.delete(
            "/admin/rate-limits/rules/:id",
            async (req: Request, res: Response) => {
                if (!requireAdminSecret(req, res)) return;
                try {
                    const removed =
                        uuidValidate(req.params.id) &&
                        (await this.config.remove(req.params.id));
                    if (!removed) {
                        return res
                            .status(404)
                            .json({ error: "Rule not found" });
                    }
                    console.log(
                        `[rate-limit] ${req.header("x-admin-ename") ?? "unknown"} removed rule ${req.params.id}`,
                    );
                    res.status(204).end();
                } catch (error) {
                    console.error("[rate-limit] could not remove rule:", error);
                    res.status(500).json({
                        error: "Could not remove the rule",
                    });
                }
            },
        );
    }
}
