import { Request, Response } from "express";
import { ReferenceService } from "../services/ReferenceService";
import { CalculationService } from "../services/CalculationService";
import { authGuard } from "../middleware/auth";

export class DashboardController {
    private referenceService: ReferenceService;
    private calculationService: CalculationService;

    constructor() {
        this.referenceService = new ReferenceService();
        this.calculationService = new CalculationService();
    }

    /**
     * Maps reference status from DB format to display format.
     */
    private mapReferenceStatus(status: string): string {
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

    getStats = async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            
            // Get total references received by this user
            const receivedReferences = await this.referenceService.getReferencesForTarget("user", userId);
            
            res.json({
                totalReferences: receivedReferences.length.toString()
            });
        } catch (error) {
            console.error("Error getting dashboard stats:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getActivities = async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const filter = req.query.filter as string || 'all';
            const offset = (page - 1) * limit;

            // Get user's sent references
            const sentReferences = await this.referenceService.getUserReferences(userId);
            
            // Get user's calculations
            const calculations = await this.calculationService.getUserCalculations(userId);
            
            // Get references received by this user
            const receivedReferences = await this.referenceService.getReferencesForTarget("user", userId);

            // Combine and format activities
            const activities: any[] = [];

            // Add sent references (only if filter allows)
            if (filter === 'all' || filter === 'sent-references') {
                sentReferences.forEach(ref => {
                    activities.push({
                        id: `ref-sent-${ref.id}`,
                        type: 'reference',
                        activity: 'Reference Provided',
                        target: ref.targetName,
                        targetType: ref.targetType,
                        date: ref.createdAt,
                        status: this.mapReferenceStatus(ref.status),
                        data: ref
                    });
                });
            }

            // Add received references (only if filter allows)
            if (filter === 'all' || filter === 'received-references') {
                receivedReferences.forEach(ref => {
                    // Get author name, preferring name over ename, with fallback
                    const authorName = ref.author?.name || ref.author?.ename || ref.author?.handle || 'Unknown';
                    activities.push({
                        id: `ref-received-${ref.id}`,
                        type: 'reference',
                        activity: 'Reference Received',
                        target: authorName,
                        targetType: 'user',
                        date: ref.createdAt,
                        status: this.mapReferenceStatus(ref.status),
                        data: ref
                    });
                });
            }

            // Add calculations (only if filter allows)
            if (filter === 'all' || filter === 'analysis' || filter === 'self-evaluation' || filter === 'other-evaluations') {
                calculations.forEach(calc => {
                    // Determine activity type based on targetType
                    let activityType: string;
                    if (calc.targetType === 'self') {
                        activityType = 'Self eReputation';
                    } else if (calc.targetType === 'user') {
                        activityType = 'User Evaluation';
                    } else if (calc.targetType === 'group') {
                        activityType = 'Group Evaluation';
                    } else {
                        activityType = 'Platform Analysis';
                    }
                    
                    // Apply specific filters
                    if (filter === 'self-evaluation' && calc.targetType !== 'self') {
                        return; // Skip non-self evaluations
                    }
                    if (filter === 'other-evaluations' && calc.targetType === 'self') {
                        return; // Skip self evaluations
                    }
                    if (filter === 'analysis' && calc.targetType === 'self') {
                        return; // Skip self evaluations for analysis filter
                    }
                    
                    // Parse calculation details to get explanation
                    let explanation = null;
                    try {
                        if (calc.calculationDetails) {
                            const details = JSON.parse(calc.calculationDetails);
                            explanation = details.explanation || null;
                        }
                    } catch (e) {
                        // If parsing fails, explanation remains null
                    }
                    
                    activities.push({
                        id: `calc-${calc.id}`,
                        type: 'calculation',
                        activity: activityType,
                        target: calc.targetName || 'Personal Profile',
                        targetType: calc.targetType,
                        date: calc.createdAt,
                        status: calc.status,
                        result: calc.calculatedScore ? `Score: ${calc.calculatedScore}/5` : 'Calculating...',
                        explanation: explanation,
                        data: calc
                    });
                });
            }

            // Sort by date (newest first)
            activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Paginate
            const total = activities.length;
            const totalPages = Math.ceil(total / limit);
            const paginatedActivities = activities.slice(offset, offset + limit);

            res.json({
                activities: paginatedActivities,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            });
        } catch (error) {
            console.error("Error getting dashboard activities:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
