import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { UserService } from "../services/UserService";
import { EventEmitter } from "events";
import { signToken } from "../utils/jwt";
import { verifySignature } from "signature-validator";

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
        const baseUrl = process.env.VITE_ECURRENCY_BASE_URL || "http://localhost:9888";
        const url = new URL(
            "/api/auth",
            baseUrl,
        ).toString();
        const sessionId = uuidv4();
        const offer = `w3ds://auth?redirect=${url}&session=${sessionId}&platform=ecurrency`;
        res.json({ offer, sessionId });
    };

    login = async (req: Request, res: Response) => {
        try {
            const { ename, session, w3id, signature } = req.body;

            console.log(signature, ename, session)

            if (!ename) {
                return res.status(400).json({ error: "ename is required" });
            }

            if (!session) {
                return res.status(400).json({ error: "session is required" });
            }

            if (!signature) {
                return res.status(400).json({ error: "signature is required" });
            }

            const registryBaseUrl = process.env.PUBLIC_REGISTRY_URL;
            if (!registryBaseUrl) {
                console.error("PUBLIC_REGISTRY_URL not configured");
                return res.status(500).json({ error: "Server configuration error" });
            }

            const verificationResult = await verifySignature({
                eName: ename,
                signature: signature,
                payload: session,
                registryBaseUrl: registryBaseUrl,
            });

            if (!verificationResult.valid) {
                console.error("Signature validation failed:", verificationResult.error);
                return res.status(401).json({ 
                    error: "Invalid signature", 
                    message: verificationResult.error 
                });
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
            // Emit via SSE for backward compatibility
            this.eventEmitter.emit(session, data);
            // Return JSON response for direct POST requests
            res.status(200).json(data);
        } catch (error) {
            console.error("Error during login:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}

