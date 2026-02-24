import crypto from "node:crypto";
import { PUBLIC_REGISTRY_URL } from "$env/static/public";
import { verifySignature } from "signature-validator/src/index";
import type { WitnessSession } from "./types";

const SESSION_TTL_MS = 15 * 60 * 1000;

interface WitnessCallbackInput {
    sessionId: string;
    signature: string;
    w3id: string;
    message: string;
}

class WitnessService {
    private readonly sessions = new Map<string, WitnessSession>();

    private getRegistryUrl(): string {
        const registryUrl = PUBLIC_REGISTRY_URL;
        if (!registryUrl) throw new Error("REGISTRY_URL or PUBLIC_REGISTRY_URL is required");
        return registryUrl;
    }

    private normalizeEName(value: string): string {
        return value.startsWith("@") ? value : `@${value}`;
    }

    createWitnessSession(input: {
        targetEName: string;
        expectedWitnessEName: string;
        requestOrigin: string;
    }): { session: WitnessSession; qrData: string } {
        const now = Date.now();
        const sessionId = crypto.randomUUID();
        const targetEName = this.normalizeEName(input.targetEName);
        const expectedWitnessEName = this.normalizeEName(input.expectedWitnessEName);

        const session: WitnessSession = {
            id: sessionId,
            targetEName,
            expectedWitnessEName,
            status: "pending",
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
        };
        this.sessions.set(session.id, session);

        const data = Buffer.from(
            JSON.stringify({
                message: `Witness recovery for ${targetEName}`,
                sessionId,
                targetEName,
                expectedWitnessEName,
            }),
            "utf8",
        ).toString("base64");

        const callbackUrl = new URL("/api/witness/callback", input.requestOrigin).toString();
        const qrData = `w3ds://sign?session=${encodeURIComponent(sessionId)}&data=${encodeURIComponent(data)}&redirect_uri=${encodeURIComponent(callbackUrl)}`;

        return { session, qrData };
    }

    getSession(sessionId: string): WitnessSession | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        if (Date.now() > new Date(session.expiresAt).getTime()) {
            session.status = "expired";
            this.sessions.set(session.id, session);
        }
        return session;
    }

    async verifyWitnessCallback(input: WitnessCallbackInput): Promise<WitnessSession> {
        const session = this.getSession(input.sessionId);
        if (!session) throw new Error("Witness session not found");
        if (session.status === "expired") throw new Error("Witness session is expired");
        if (input.message !== session.id) {
            throw new Error("Invalid signed payload: expected message to equal sessionId");
        }

        const signer = this.normalizeEName(input.w3id);
        if (signer !== session.expectedWitnessEName) {
            session.status = "rejected";
            this.sessions.set(session.id, session);
            throw new Error("Unexpected witness signer");
        }

        const verification = await verifySignature({
            eName: signer,
            signature: input.signature,
            payload: input.message,
            registryBaseUrl: this.getRegistryUrl(),
        });

        if (!verification.valid) {
            session.status = "rejected";
            this.sessions.set(session.id, session);
            throw new Error(verification.error || "Invalid witness signature");
        }

        session.status = "witnessed";
        session.witnessedBy = signer;
        session.signature = input.signature;
        this.sessions.set(session.id, session);
        return session;
    }

    ensureWitnessedSessions(targetEName: string, sessionIds: string[]): WitnessSession[] {
        const normalizedTarget = this.normalizeEName(targetEName);
        if (sessionIds.length === 0) {
            throw new Error("At least one witness session is required");
        }

        return sessionIds.map((sessionId) => {
            const session = this.getSession(sessionId);
            if (!session) throw new Error(`Witness session not found: ${sessionId}`);
            if (session.status !== "witnessed") {
                throw new Error(`Witness session is not completed: ${sessionId}`);
            }
            if (session.targetEName !== normalizedTarget) {
                throw new Error(`Witness session target mismatch: ${sessionId}`);
            }
            return session;
        });
    }
}

export const witnessService = new WitnessService();
