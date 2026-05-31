import { EventEmitter } from "node:events";
import {
    buildAuthOffer,
    signToken,
    verifyLoginSignature,
} from "@metastate-foundation/auth";
import type { Request, Response } from "express";
import { env } from "../env";
import type { UserService } from "../services/UserService";

export class AuthController {
    private events = new EventEmitter();

    constructor(private users: UserService) {}

    getOffer = async (_req: Request, res: Response) => {
        const offer = buildAuthOffer({
            baseUrl: env.baseUrl,
            platform: "profile-editor",
        });
        res.json({ uri: offer.uri });
    };

    sseStream = async (req: Request, res: Response) => {
        const { id } = req.params;

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
        });

        const handler = (data: unknown) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };
        this.events.on(id, handler);

        const heartbeat = setInterval(() => {
            try {
                res.write(": heartbeat\n\n");
            } catch {
                clearInterval(heartbeat);
            }
        }, 30000);

        const cleanup = () => {
            clearInterval(heartbeat);
            this.events.off(id, handler);
            res.end();
        };
        req.on("close", cleanup);
        req.on("error", cleanup);
    };

    login = async (req: Request, res: Response) => {
        try {
            const { ename, session, signature } = req.body;

            const result = await verifyLoginSignature({
                eName: ename,
                signature,
                session,
                registryBaseUrl: env.registryUrl,
            });

            if (!result.valid) {
                return res.status(401).json({
                    error: "Invalid signature",
                    message: result.error,
                });
            }

            const token = signToken({ userId: ename }, env.jwtSecret);

            let name = ename;
            try {
                name = (await this.users.findByEname(ename))?.name ?? ename;
            } catch {
                /* fall back to ename */
            }

            const data = { user: { id: ename, ename, name }, token };
            this.events.emit(session, data);
            res.status(200).json(data);
        } catch (error) {
            console.error("Error during login:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
