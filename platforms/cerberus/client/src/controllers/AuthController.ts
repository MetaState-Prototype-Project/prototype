import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { UserService } from "../services/UserService";
import { EventEmitter } from "events";

export class AuthController {
    private userService: UserService;
    private eventEmitter: EventEmitter;

    constructor() {
        this.userService = new UserService();
        this.eventEmitter = new EventEmitter();
    }

    sseStream = async (req: Request, res: Response) => {
        const { id } = req.params;

        // Set headers for SSE
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

        // Handle client disconnect
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
            process.env.PUBLIC_CERBERUS_BASE_URL,
        ).toString();
        const session = uuidv4();
        const offer = `w3ds://auth?redirect=${url}&session=${session}&platform=Cerberus`;
        res.json({ uri: offer });
    };

    login = async (req: Request, res: Response) => {
        try {
            const { ename, session } = req.body;

            if (!ename) {
                return res.status(400).json({ error: "ename is required" });
            }

            const { user, token } =
                await this.userService.findOrCreateUser(ename);

            const data = {
                user: {
                    id: user.id,
                    ename: user.ename,
                    isVerified: user.isVerified,
                    isPrivate: user.isPrivate,
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