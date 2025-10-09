import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { UserService } from "../services/UserService";
import { EventEmitter } from "events";
import { signToken } from "../utils/jwt";

export class AuthController {
    private userService: UserService;
    private eventEmitter: EventEmitter;

    constructor() {
        this.userService = new UserService();
        this.eventEmitter = new EventEmitter();
    }

    sseStream = async (req: Request, res: Response) => {
        const { id } = req.params;

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
        });

        const handler = (data: any) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        this.eventEmitter.on(id, handler);

        req.on("close", () => {
            this.eventEmitter.off(id, handler);
            res.end();
        });

        req.on("error", (error) => {
            console.error("SSE Error:", error);
            this.eventEmitter.off(id, handler);
            res.end();
        });
    };

    getOffer = async (req: Request, res: Response) => {
        const url = new URL(
            "/api/auth",
            process.env.PUBLIC_DREAMSYNC_BASE_URL,
        ).toString();
        const sessionId = uuidv4();
        const offer = `w3ds://auth?redirect=${url}&session=${sessionId}&platform=dreamsync`;
        res.json({ offer, sessionId });
    };

    login = async (req: Request, res: Response) => {
        try {
            const { ename, session, w3id, signature } = req.body;

            if (!ename) {
                return res.status(400).json({ error: "ename is required" });
            }

            if (!session) {
                return res.status(400).json({ error: "session is required" });
            }

            // Only find existing users - don't create new ones during auth
            const user = await this.userService.findUser(ename);
            
            if (!user) {
                // User doesn't exist - they need to be created via webhook first
                return res.status(404).json({ 
                    error: "User not found", 
                    message: "User must be created via eVault webhook before authentication" 
                });
            }

            // TODO: Verify signature if w3id and signature are provided
            // For now, we'll accept the authentication without signature verification
            // This should be implemented to verify the signature against the session data

            const token = signToken({ userId: user.id });

            const data = {
                user: {
                    id: user.id,
                    ename: user.ename,
                    name: user.name,
                    handle: user.handle,
                    description: user.description,
                    avatarUrl: user.avatarUrl,
                    bannerUrl: user.bannerUrl,
                    isVerified: user.isVerified,
                    isPrivate: user.isPrivate,
                    email: user.email,
                    emailVerified: user.emailVerified,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                },
                token,
            };
            this.eventEmitter.emit(session, data);
            res.status(200).send();
        } catch (error) {
            console.error("Error during login:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
