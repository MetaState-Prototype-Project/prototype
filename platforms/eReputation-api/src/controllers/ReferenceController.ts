import { Request, Response } from "express";
import { ReferenceService } from "../services/ReferenceService";
import { authGuard } from "../middleware/auth";

export class ReferenceController {
    private referenceService: ReferenceService;

    constructor() {
        this.referenceService = new ReferenceService();
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

            const reference = await this.referenceService.createReference({
                targetType,
                targetId,
                targetName,
                content,
                referenceType: referenceType || "general",
                numericScore,
                authorId
            });

            res.status(201).json({
                message: "Reference created successfully",
                reference: {
                    id: reference.id,
                    targetType: reference.targetType,
                    targetName: reference.targetName,
                    content: reference.content,
                    numericScore: reference.numericScore,
                    status: reference.status,
                    createdAt: reference.createdAt
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
