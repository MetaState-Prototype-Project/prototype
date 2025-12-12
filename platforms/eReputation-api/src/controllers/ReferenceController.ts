import { Request, Response } from "express";
import { ReferenceService } from "../services/ReferenceService";
import { ReferenceSigningSessionService } from "../services/ReferenceSigningSessionService";
import { authGuard } from "../middleware/auth";

export class ReferenceController {
    private referenceService: ReferenceService;
    private signingSessionService: ReferenceSigningSessionService;

    constructor() {
        this.referenceService = new ReferenceService();
        this.signingSessionService = new ReferenceSigningSessionService();
    }

    createReference = async (req: Request, res: Response) => {
        try {
            const { targetType, targetId, targetName, content, referenceType, numericScore } = req.body;
            const authorId = req.user!.id;

            if (!targetType || !targetId || !targetName || !content) {
                return res.status(400).json({ error: "Missing required fields" });
            }

            if (numericScore && (numericScore < 1 || numericScore > 5)) {
                return res.status(400).json({ error: "Numeric score must be between 1 and 5" });
            }

            // Create reference with "pending" status (requires signature)
            const reference = await this.referenceService.createReference({
                targetType,
                targetId,
                targetName,
                content,
                referenceType: referenceType || "general",
                numericScore,
                authorId
            });

            // Create signing session for the reference
            const signingSession = await this.signingSessionService.createSession(
                reference.id,
                {
                    targetType,
                    targetId,
                    targetName,
                    content,
                    referenceType: referenceType || "general",
                    numericScore
                },
                authorId
            );

            res.status(201).json({
                message: "Reference created successfully. Please sign to complete.",
                reference: {
                    id: reference.id,
                    targetType: reference.targetType,
                    targetName: reference.targetName,
                    content: reference.content,
                    numericScore: reference.numericScore,
                    status: reference.status,
                    createdAt: reference.createdAt
                },
                signingSession: {
                    sessionId: signingSession.sessionId,
                    qrData: signingSession.qrData,
                    expiresAt: signingSession.expiresAt
                }
            });
        } catch (error) {
            console.error("Error creating reference:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getReferencesForTarget = async (req: Request, res: Response) => {
        try {
            const { targetType, targetId } = req.params;

            const references = await this.referenceService.getReferencesForTarget(targetType, targetId);

            res.json({
                references: references.map(ref => ({
                    id: ref.id,
                    content: ref.content,
                    numericScore: ref.numericScore,
                    referenceType: ref.referenceType,
                    status: ref.status,
                    author: {
                        id: ref.author.id,
                        ename: ref.author.ename,
                        name: ref.author.name
                    },
                    createdAt: ref.createdAt
                }))
            });
        } catch (error) {
            console.error("Error getting references:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    /**
     * Combined references (sent + received) for the authenticated user with pagination.
     */
    getAllUserReferences = async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const page = parseInt(req.query.page as string, 10) || 1;
            const limit = parseInt(req.query.limit as string, 10) || 10;
            const offset = (page - 1) * limit;

            // Sent references (auth user is author)
            const sentReferences = await this.referenceService.getUserReferences(userId);

            // Received references (auth user is target) - author relation already loaded
            const receivedReferences = await this.referenceService.getReferencesForTarget("user", userId);

            const formatted = [
                ...sentReferences.map((ref) => ({
                    id: ref.id,
                    type: "Sent" as const,
                    forFrom: ref.targetName,
                    targetType: ref.targetType,
                    targetName: ref.targetName,
                    referenceType: ref.referenceType,
                    numericScore: ref.numericScore,
                    content: ref.content,
                    status: ref.status === "revoked" ? "Revoked" : "Signed",
                    date: ref.createdAt,
                })),
                ...receivedReferences.map((ref) => ({
                    id: ref.id,
                    type: "Received" as const,
                    forFrom: ref.author?.name || ref.author?.ename || "Unknown",
                    targetType: ref.targetType,
                    targetName: ref.targetName,
                    referenceType: ref.referenceType,
                    numericScore: ref.numericScore,
                    content: ref.content,
                    status: ref.status === "revoked" ? "Revoked" : "Signed",
                    date: ref.createdAt,
                    author: {
                        id: ref.author?.id,
                        ename: ref.author?.ename,
                        name: ref.author?.name,
                    },
                })),
            ];

            // Sort newest first
            formatted.sort(
                (a, b) => new Date(b.date as unknown as string).getTime() - new Date(a.date as unknown as string).getTime(),
            );

            const total = formatted.length;
            const totalPages = Math.max(1, Math.ceil(total / limit));
            const paginated = formatted.slice(offset, offset + limit);

            res.json({
                references: paginated,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1,
                },
            });
        } catch (error) {
            console.error("Error getting user references:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getUserReferences = async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const references = await this.referenceService.getUserReferences(userId);

            res.json({
                references: references.map(ref => ({
                    id: ref.id,
                    targetType: ref.targetType,
                    targetName: ref.targetName,
                    content: ref.content,
                    numericScore: ref.numericScore,
                    referenceType: ref.referenceType,
                    status: ref.status,
                    createdAt: ref.createdAt
                }))
            });
        } catch (error) {
            console.error("Error getting user references:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    revokeReference = async (req: Request, res: Response) => {
        try {
            const { referenceId } = req.params;
            const userId = req.user!.id;

            const reference = await this.referenceService.revokeReference(referenceId, userId);

            if (!reference) {
                return res.status(404).json({ error: "Reference not found or not authorized" });
            }

            res.json({
                message: "Reference revoked successfully",
                reference: {
                    id: reference.id,
                    status: reference.status
                }
            });
        } catch (error) {
            console.error("Error revoking reference:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
