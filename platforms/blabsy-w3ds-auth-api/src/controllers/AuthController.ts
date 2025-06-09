import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { auth } from "firebase-admin";
export class AuthController {
    private eventEmitter: EventEmitter;

    constructor() {
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
            process.env.PUBLIC_BLABSY_BASE_URL
        ).toString();
        const session = uuidv4();
        const offer = `w3ds://auth?redirect=${url}&session=${session}&platform=blabsy`;
        res.json({ uri: offer });
    };

    login = async (req: Request, res: Response) => {
        try {
            const { ename, session } = req.body;

            if (!ename) {
                return res.status(400).json({ error: "ename is required" });
            }
            const token = await auth().createCustomToken(ename);
            console.log(token);

            this.eventEmitter.emit(session, { token });
            res.status(200).send();
        } catch (error) {
            console.error("Error during login:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
