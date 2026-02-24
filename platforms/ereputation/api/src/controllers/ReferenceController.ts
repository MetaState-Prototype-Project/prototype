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

    /**
     * Get ALL signed references in the system (internal visualizer endpoint).
     * Requires X-Visualizer-Key header matching VISUALIZER_API_KEY env var.
     */
    getAllReferences = async (req: Request, res: Response) => {
        const apiKey = process.env.VISUALIZER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server misconfiguration: VISUALIZER_API_KEY is not set' });
        }
        if (req.headers['x-visualizer-key'] !== apiKey) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const MAX_LIMIT = 500;
            const rawLimit = parseInt(req.query.limit as string, 10);
            const rawOffset = parseInt(req.query.offset as string, 10);
            const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : MAX_LIMIT;
            const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

            const references = await this.referenceService.getAllReferences(limit, offset);

            res.json({
                references: references.map(ref => ({
                    id: ref.id,
                    content: ref.content,
                    numericScore: ref.numericScore,
                    referenceType: ref.referenceType,
                    status: ref.status,
                    targetType: ref.targetType,
                    targetId: ref.targetId,
                    targetName: ref.targetName,
                    author: ref.author ?{
                        id: ref.author.id,
                        ename: ref.author.ename,
                        name: ref.author.name
                    } : null,
                    createdAt: ref.createdAt
                }))
            });
        } catch (error) {
            console.error("Error getting all references:", error);
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
     * Maps reference status from DB format to display format.
     */
    private mapStatus(status: string): string {
        switch (status?.toLowerCase()) {
            case "revoked":
                return "Revoked";
            case "signed":
            case "active":
                return "Signed";
            case "pending":
                return "Pending";
            default:
                return "Unknown";
        }
    }

    /**
     * Combined references (sent + received) for the authenticated user with pagination.
     * Uses DB-level pagination to avoid loading all records into memory.
     */
    getAllUserReferences = async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const MAX_LIMIT = 100;
            const MAX_FETCH = 500; // Maximum records to fetch for merging

            // Sanitize and clamp inputs
            let page = parseInt(req.query.page as string, 10) || 1;
            let limit = parseInt(req.query.limit as string, 10) || 10;
            page = Math.max(1, page);
            limit = Math.min(Math.max(1, limit), MAX_LIMIT);
            const offset = (page - 1) * limit;

            // Calculate how many records we need to fetch to cover the requested page
            // We need at least (page * limit) records from each query to ensure we have enough
            // after merging, but cap it to avoid loading too much
            const recordsNeeded = page * limit;
            const fetchLimit = Math.min(Math.max(recordsNeeded, limit * 2), MAX_FETCH);

            // Fetch paginated results from both queries using DB-level pagination
            const sentResult = await this.referenceService.getUserReferencesPaginated(userId, 1, fetchLimit);
            const receivedResult = await this.referenceService.getReferencesForTargetPaginated("user", userId, 1, fetchLimit, false);

            // Format and merge results
            const formatted = [
                ...sentResult.references.map((ref) => ({
                    id: ref.id,
                    type: "Sent" as const,
                    forFrom: ref.targetName,
                    targetType: ref.targetType,
                    targetName: ref.targetName,
                    referenceType: ref.referenceType,
                    numericScore: ref.numericScore,
                    content: ref.content,
                    status: this.mapStatus(ref.status),
                    date: ref.createdAt,
                })),
                ...receivedResult.references.map((ref) => ({
                    id: ref.id,
                    type: "Received" as const,
                    forFrom: ref.author?.name || ref.author?.ename || "Unknown",
                    targetType: ref.targetType,
                    targetName: ref.targetName,
                    referenceType: ref.referenceType,
                    numericScore: ref.numericScore,
                    content: ref.content,
                    status: this.mapStatus(ref.status),
                    date: ref.createdAt,
                    author: {
                        id: ref.author?.id,
                        ename: ref.author?.ename,
                        name: ref.author?.name,
                    },
                })),
            ];

            // Sort newest first (already sorted by DB, but merge may need re-sort)
            formatted.sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
            );

            // Calculate total from both queries
            const total = sentResult.total + receivedResult.total;

            // Apply final pagination to merged results
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
