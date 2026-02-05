import { Request, Response } from "express";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { verifySignature } from "signature-validator";
import { isVersionValid } from "../utils/version";
import { addSession, isSessionValid } from "../constants";

const MIN_REQUIRED_VERSION = "0.4.0";
const JWT_EXPIRES_IN = "7d";

export class AuthController {
  private eventEmitter = new EventEmitter();

  getOffer = async (_req: Request, res: Response) => {
    console.log("[auth] GET /api/auth/offer hit");
    const baseUrl = process.env.NEXT_PUBLIC_CALENDAR_APP_URL;
    if (!baseUrl) {
      console.error("[auth] NEXT_PUBLIC_CALENDAR_APP_URL is not set");
      return res.status(500).json({ error: "Server configuration error: NEXT_PUBLIC_CALENDAR_APP_URL not set" });
    }

    let redirectUri: string;
    try {
      redirectUri = new URL("/api/auth", baseUrl).toString();
    } catch (err) {
      console.error("[auth] Invalid NEXT_PUBLIC_CALENDAR_APP_URL:", baseUrl, err);
      return res.status(500).json({ error: "Server configuration error: invalid base URL" });
    }

    const session = uuidv4();
    addSession(session);
    const offer = `w3ds://auth?redirect=${encodeURIComponent(redirectUri)}&session=${session}&platform=${encodeURIComponent(baseUrl)}`;
    console.log("[auth] offer created, redirectUri=", redirectUri, "platform=", baseUrl);
    res.json({ uri: offer, sessionId: session });
  };

  sseStream = async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log("[auth] GET /api/auth/sessions/:id hit, sessionId=", id);
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
    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);
    req.on("close", () => {
      clearInterval(heartbeat);
      this.eventEmitter.off(id, handler);
      res.end();
    });
  };

  login = async (req: Request, res: Response) => {
    console.log("[auth] POST /api/auth hit");
    try {
      const { ename, session, signature, appVersion } = req.body;
      console.log("[auth] body: ename=", ename, "session=", session?.slice(0, 8) + "...", "appVersion=", appVersion, "signature present=", !!signature);

      if (!ename) {
        console.log("[auth] reject: ename missing");
        return res.status(400).json({ error: "ename is required" });
      }
      if (!session) {
        console.log("[auth] reject: session missing");
        return res.status(400).json({ error: "session is required" });
      }
      if (!signature) {
        console.log("[auth] reject: signature missing");
        return res.status(400).json({ error: "signature is required" });
      }

      if (!isSessionValid(session)) {
        console.log("[auth] reject: invalid or expired session");
        return res
          .status(400)
          .json({ error: "Invalid or expired session", message: "Please request a new login offer." });
      }

      if (!appVersion || !isVersionValid(appVersion, MIN_REQUIRED_VERSION)) {
        console.log("[auth] reject: app version too old", appVersion);
        return res.status(400).json({
          error: "App version too old",
          message: `Please update eID Wallet to version ${MIN_REQUIRED_VERSION} or later.`,
        });
      }

      const registryBaseUrl = process.env.PUBLIC_REGISTRY_URL;
      if (!registryBaseUrl) {
        console.log("[auth] reject: PUBLIC_REGISTRY_URL not set");
        return res.status(500).json({ error: "Server configuration error" });
      }

      console.log("[auth] verifying signature with registry", registryBaseUrl);
      const verificationResult = await verifySignature({
        eName: ename,
        signature,
        payload: session,
        registryBaseUrl,
      });

      if (!verificationResult.valid) {
        console.log("[auth] reject: signature invalid", verificationResult.error);
        return res.status(401).json({
          error: "Invalid signature",
          message: verificationResult.error,
        });
      }

      const secret = process.env.JWT_SECRET || "calendar-api-dev-secret";
      const token = jwt.sign(
        { ename },
        secret,
        { expiresIn: JWT_EXPIRES_IN }
      );

      console.log("[auth] login success, ename=", ename);
      this.eventEmitter.emit(session, { token });
      res.status(200).json({ token });
    } catch (error) {
      console.error("[auth] login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
