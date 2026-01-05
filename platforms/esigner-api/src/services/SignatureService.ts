import crypto from "crypto";
import { AppDataSource } from "../database/data-source";
import { File } from "../database/entities/File";
import { SignatureContainer } from "../database/entities/SignatureContainer";
import { FileSignee } from "../database/entities/FileSignee";
import { InvitationService } from "./InvitationService";
import { UserService } from "./UserService";
import { NotificationService } from "./NotificationService";
import { verifySignature } from "signature-validator";

export interface SigningSession {
    sessionId: string;
    fileId: string;
    userId: string;
    md5Hash: string;
    qrData: string;
    createdAt: Date;
    expiresAt: Date;
    status: "pending" | "signed" | "expired" | "completed" | "security_violation";
}

export interface SigningResult {
    success: boolean;
    error?: string;
    sessionId: string;
    fileId: string;
    userId: string;
    signature?: string;
    publicKey?: string;
    message?: string;
    type: "signed" | "security_violation";
}

export class SignatureService {
    private sessions: Map<string, SigningSession> = new Map(); // Keyed by sessionId (userId_md5)
    private signatureRepository = AppDataSource.getRepository(SignatureContainer);
    private fileRepository = AppDataSource.getRepository(File);
    private fileSigneeRepository = AppDataSource.getRepository(FileSignee);
    private invitationService = new InvitationService();
    private userService = new UserService();
    private notificationService = new NotificationService();

    async createSession(fileId: string, userId: string): Promise<SigningSession> {
        // Verify user has pending invitation
        const invitation = await this.invitationService.getPendingInvitation(fileId, userId);
        if (!invitation) {
            throw new Error("No pending invitation found for this file");
        }

        // Get file to retrieve MD5 hash
        const file = await this.fileRepository.findOne({
            where: { id: fileId },
        });

        if (!file) {
            throw new Error("File not found");
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

        // Create session ID as userId_md5 so wallet signs both assertions:
        // 1. The user ID (who is signing)
        // 2. The MD5 hash (what file they're signing)
        const sessionId = `${userId}_${file.md5Hash}`;

        // Create signature request data with MD5 hash
        const messageData = JSON.stringify({
            message: `Sign file: ${file.name}`,
            md5Hash: file.md5Hash,
            sessionId: sessionId
        });

        const base64Data = Buffer.from(messageData).toString('base64');
        const apiBaseUrl = process.env.PUBLIC_ESIGNER_BASE_URL || "http://localhost:3004";
        const redirectUri = `${apiBaseUrl}/api/signatures/callback`;

        // Put userId_md5 as the session parameter so wallet signs both assertions
        const qrData = `w3ds://sign?session=${encodeURIComponent(sessionId)}&data=${base64Data}&redirect_uri=${encodeURIComponent(redirectUri)}`;

        const session: SigningSession = {
            sessionId,
            fileId,
            userId,
            md5Hash: file.md5Hash,
            qrData,
            createdAt: now,
            expiresAt,
            status: "pending"
        };

        this.sessions.set(sessionId, session);
        console.log(`Created signing session ${sessionId} for file ${fileId}, total sessions: ${this.sessions.size}`);

        // Set up expiration cleanup
        setTimeout(() => {
            const session = this.sessions.get(sessionId);
            if (session && session.status === "pending") {
                session.status = "expired";
                this.sessions.set(sessionId, session);
            }
        }, 15 * 60 * 1000);

        return session;
    }

    async getSession(sessionId: string): Promise<SigningSession | null> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            return null;
        }

        // Check if session has expired
        if (session.status === "pending" && new Date() > session.expiresAt) {
            session.status = "expired";
            this.sessions.set(sessionId, session);
        }

        return session;
    }

    async processSignedPayload(
        sessionId: string,
        signature: string,
        publicKey: string,
        message: string
    ): Promise<SigningResult> {
        console.log(`Processing signed payload. Received sessionId: ${sessionId}, message: ${message}`);

        // The wallet signs the sessionId which is userId_md5 format
        // So sessionId and message should both be userId_md5
        // Find session by sessionId
        const session = await this.getSession(sessionId);

        if (!session) {
            throw new Error("Session not found");
        }

        if (session.status !== "pending") {
            throw new Error("Session is not in pending state");
        }

        if (!signature || !publicKey || !message) {
            throw new Error("Invalid signature data");
        }

        // Verify signature using signature-validator
        const registryBaseUrl = process.env.PUBLIC_REGISTRY_URL;
        if (!registryBaseUrl) {
            throw new Error("PUBLIC_REGISTRY_URL not configured");
        }

        // Get user to verify ename
        const user = await this.userService.getUserById(session.userId);
        if (!user) {
            throw new Error("User not found for session");
        }

        // The wallet signs the sessionId which is userId_md5 format
        // The message field from the wallet should contain userId_md5 that was signed
        // Verify signature against the sessionId (userId_md5)
        const payloadToVerify = message || sessionId; // The message should be userId_md5 that was signed
        console.log(`Verifying signature. Payload (signed): ${payloadToVerify}, Expected: ${session.sessionId}`);
        
        // Verify the payload matches the expected sessionId format (userId_md5)
        const expectedPayload = `${session.userId}_${session.md5Hash}`;
        if (payloadToVerify !== expectedPayload && payloadToVerify !== session.sessionId) {
            console.error(`🔒 SECURITY VIOLATION: payload mismatch!`, {
                receivedPayload: payloadToVerify,
                expectedPayload: expectedPayload,
                sessionId: session.sessionId,
            });
            session.status = "security_violation";
            this.sessions.set(session.sessionId, session);
            return {
                success: false,
                error: "Signed payload does not match expected format",
                sessionId: session.sessionId,
                fileId: session.fileId,
                userId: session.userId,
                type: "security_violation"
            };
        }
        
        // Verify signature against the sessionId (userId_md5)
        const verificationResult = await verifySignature({
            eName: user.ename,
            signature: signature,
            payload: payloadToVerify, // Verify against userId_md5 that was signed
            registryBaseUrl: registryBaseUrl,
        });

        if (!verificationResult.valid) {
            console.error("Signature validation failed:", verificationResult.error);
            session.status = "security_violation";
            this.sessions.set(session.sessionId, session);
            return {
                success: false,
                error: verificationResult.error || "Invalid signature",
                sessionId: session.sessionId,
                fileId: session.fileId,
                userId: session.userId,
                type: "security_violation"
            };
        }
        
        // Extract userId and md5Hash from the signed payload to verify
        const payloadParts = payloadToVerify.split('_');
        if (payloadParts.length < 2) {
            console.error(`🔒 SECURITY VIOLATION: invalid payload format!`, {
                payload: payloadToVerify,
            });
            session.status = "security_violation";
            this.sessions.set(session.sessionId, session);
            return {
                success: false,
                error: "Invalid payload format",
                sessionId: session.sessionId,
                fileId: session.fileId,
                userId: session.userId,
                type: "security_violation"
            };
        }
        
        const signedUserId = payloadParts[0];
        const signedMd5Hash = payloadParts.slice(1).join('_'); // In case md5 hash contains underscores
        
        // Verify the signed userId matches the session userId
        if (signedUserId !== session.userId) {
            console.error(`🔒 SECURITY VIOLATION: userId mismatch!`, {
                signedUserId,
                expectedUserId: session.userId,
            });
            session.status = "security_violation";
            this.sessions.set(session.sessionId, session);
            return {
                success: false,
                error: "Signed user ID does not match session user ID",
                sessionId: session.sessionId,
                fileId: session.fileId,
                userId: session.userId,
                type: "security_violation"
            };
        }
        
        // Verify the signed MD5 hash matches the file's MD5 hash
        if (signedMd5Hash !== session.md5Hash) {
            console.error(`🔒 SECURITY VIOLATION: MD5 hash mismatch!`, {
                signedMd5Hash,
                expectedMd5Hash: session.md5Hash,
            });
            session.status = "security_violation";
            this.sessions.set(session.sessionId, session);
            return {
                success: false,
                error: "Signed MD5 hash does not match file hash",
                sessionId: session.sessionId,
                fileId: session.fileId,
                userId: session.userId,
                type: "security_violation"
            };
        }

        // Verify publicKey matches user's ename
        const cleanPublicKey = publicKey.replace(/^@/, '');
        const cleanUserEname = user.ename.replace(/^@/, '');

        if (cleanPublicKey !== cleanUserEname) {
            console.error(`🔒 SECURITY VIOLATION: publicKey mismatch!`, {
                publicKey,
                userEname: user.ename,
                cleanPublicKey,
                cleanUserEname,
            });

            session.status = "security_violation";
            this.sessions.set(sessionId, session);

            return {
                success: false,
                error: "Public key does not match the user who created this signing session",
                sessionId,
                fileId: session.fileId,
                userId: session.userId,
                type: "security_violation"
            };
        }


        // Get invitation to link signature
        const invitation = await this.invitationService.getPendingInvitation(session.fileId, session.userId);
        if (!invitation) {
            throw new Error("Invitation not found");
        }

            // Store signature in database
            try {
                const signatureContainer = this.signatureRepository.create({
                    fileId: session.fileId,
                    userId: session.userId,
                    fileSigneeId: invitation.id,
                    md5Hash: session.md5Hash,
                    signature,
                    publicKey,
                    message: payloadToVerify, // Store the userId_md5 that was signed
                });

            await this.signatureRepository.save(signatureContainer);

            // Update invitation status
            await this.invitationService.updateInvitationStatus(
                session.fileId,
                session.userId,
                "signed"
            );

            console.log(`✅ Signature recorded for file ${session.fileId} by user ${session.userId}`);

            // Get file and user for notifications (fire-and-forget)
            this.fileRepository.findOne({ where: { id: session.fileId } }).then(async (file) => {
                if (!file) return;

                const signer = await this.userService.getUserById(session.userId);
                const signerName = signer?.name || signer?.ename;

                // Send notification to the owner (fire-and-forget)
                this.notificationService.sendSignatureNotification(file.ownerId, file, signerName).catch(error => {
                    console.error(`Failed to send signature notification to owner:`, error);
                });

                // Check if all parties have signed
                const allSignees = await this.fileSigneeRepository.find({
                    where: { fileId: session.fileId },
                });

                const allSigned = allSignees.every(signee => signee.status === "signed");
                
                if (allSigned && allSignees.length > 0) {
                    // Send fully signed notification to all signees (fire-and-forget)
                    const signeeIds = allSignees.map(s => s.userId);
                    this.notificationService.sendFullySignedNotification(file, signeeIds).catch(error => {
                        console.error(`Failed to send fully signed notifications:`, error);
                    });
                }
            }).catch(error => {
                console.error(`Failed to process notifications:`, error);
            });
        } catch (error) {
            console.error("Failed to record signature:", error);
            throw new Error("Failed to record signature");
        }

        // Update session status
        session.status = "completed";
        this.sessions.set(sessionId, session);

        const result: SigningResult = {
            success: true,
            sessionId,
            fileId: session.fileId,
            userId: session.userId,
            signature,
            publicKey,
            message,
            type: "signed"
        };

        return result;
    }

    async getSessionStatus(sessionId: string): Promise<SigningSession | null> {
        return this.getSession(sessionId);
    }
}

