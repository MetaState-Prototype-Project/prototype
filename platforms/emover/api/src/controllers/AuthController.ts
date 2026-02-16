import { EventEmitter } from "events";
import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { UserService } from "../services/UserService";
import { signToken } from "../utils/jwt";
import { isVersionValid } from "../utils/version";

const MIN_REQUIRED_VERSION = "0.4.0";

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

        const handler = (data: unknown) => {
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
        const baseUrl =
            process.env.PUBLIC_EMOVER_BASE_URL || "http://localhost:4003";
        const url = new URL("/api/auth", baseUrl).toString();
        const session = uuidv4();
        const offer = `w3ds://auth?redirect=${url}&session=${session}&platform=emover`;
        res.json({ uri: offer });
    };

    login = async (req: Request, res: Response) => {
        try {
            const { ename, session, appVersion } = req.body;

            console.log(ename, session, appVersion);

            if (!ename) {
                return res.status(400).json({ error: "ename is required" });
            }

            if (!session) {
                return res.status(400).json({ error: "session is required" });
            }

            // Check app version
            if (
                !appVersion ||
                !isVersionValid(appVersion, MIN_REQUIRED_VERSION)
            ) {
                const errorMessage = {
                    error: true,
                    message: `Your eID Wallet app version is outdated. Please update to version ${MIN_REQUIRED_VERSION} or later.`,
                    type: "version_mismatch",
                };
                this.eventEmitter.emit(session, errorMessage);
                return res.status(400).json({
                    error: "App version too old",
                    message: errorMessage.message,
                });
            }

            // Find user by ename
            let user = await this.userService.findByEname(ename);

            if (!user) {
                // Create user if doesn't exist
                user = await this.userService.createUser(ename);
            }

            // Generate token
            const token = signToken({ userId: user.id });

            const data = {
                user: {
                    id: user.id,
                    ename: user.ename,
                    role: user.role,
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
