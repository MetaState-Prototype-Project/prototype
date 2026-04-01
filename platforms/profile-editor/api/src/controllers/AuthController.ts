import { Request, Response } from "express";
import { EventEmitter } from "events";
import {
	buildAuthOffer,
	signToken,
	verifyLoginSignature,
} from "@metastate-foundation/auth";
import { registerSession } from "../middleware/auth";
import type { EVaultProfileService } from "../services/EVaultProfileService";

const JWT_SECRET = process.env.PROFILE_EDITOR_JWT_SECRET!;

export class AuthController {
	private eventEmitter: EventEmitter;
	private evaultService: EVaultProfileService;

	constructor(evaultService: EVaultProfileService) {
		this.eventEmitter = new EventEmitter();
		this.evaultService = evaultService;
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

		const heartbeatInterval = setInterval(() => {
			try {
				res.write(`: heartbeat\n\n`);
			} catch {
				clearInterval(heartbeatInterval);
			}
		}, 30000);

		req.on("close", () => {
			clearInterval(heartbeatInterval);
			this.eventEmitter.off(id, handler);
			res.end();
		});

		req.on("error", () => {
			clearInterval(heartbeatInterval);
			this.eventEmitter.off(id, handler);
			res.end();
		});
	};

	getOffer = async (_req: Request, res: Response) => {
		const baseUrl = process.env.PUBLIC_PROFILE_EDITOR_BASE_URL;
		if (!baseUrl) {
			return res
				.status(500)
				.json({ error: "PUBLIC_PROFILE_EDITOR_BASE_URL not configured" });
		}

		const offer = buildAuthOffer({
			baseUrl,
			platform: "profile-editor",
		});

		res.json({ uri: offer.uri });
	};

	login = async (req: Request, res: Response) => {
		try {
			const { ename, session, signature } = req.body;

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
				return res
					.status(500)
					.json({ error: "Server configuration error" });
			}

			const result = await verifyLoginSignature({
				eName: ename,
				signature,
				session,
				registryBaseUrl,
			});

			if (!result.valid) {
				return res.status(401).json({
					error: "Invalid signature",
					message: result.error,
				});
			}

			const userId = ename;
			const token = signToken({ userId }, JWT_SECRET);
			await registerSession(userId, ename, token);

			let name: string | undefined;
			try {
				const profile = await this.evaultService.getProfile(ename);
				name = profile.name ?? ename;
			} catch {
				name = ename;
			}

			const data = {
				user: { id: userId, ename, name },
				token,
			};

			this.eventEmitter.emit(session, data);
			res.status(200).json(data);
		} catch (error) {
			console.error("Error during login:", error);
			res.status(500).json({ error: "Internal server error" });
		}
	};
}
