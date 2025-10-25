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
            const offset = (page - 1) * limit;

            // Get user's sent references
            const sentReferences = await this.referenceService.getUserReferences(userId);
            
            // Get user's calculations
            const calculations = await this.calculationService.getUserCalculations(userId);
            
            // Get references received by this user
            const receivedReferences = await this.referenceService.getReferencesForTarget("user", userId);

            // Combine and format activities
            const activities: any[] = [];

            // Add sent references
            sentReferences.forEach(ref => {
                activities.push({
                    id: `ref-sent-${ref.id}`,
                    type: 'reference',
                    activity: 'Reference Provided',
                    target: ref.targetName,
                    targetType: ref.targetType,
                    date: ref.createdAt,
                    status: ref.status === 'revoked' ? 'Revoked' : 'Signed',
                    data: ref
                });
            });

            // Add received references
            receivedReferences.forEach(ref => {
                activities.push({
                    id: `ref-received-${ref.id}`,
                    type: 'reference',
                    activity: 'Reference Received',
                    target: ref.author.ename || ref.author.name,
                    targetType: 'user',
                    date: ref.createdAt,
                    status: ref.status === 'revoked' ? 'Revoked' : 'Signed',
                    data: ref
                });
            });

            // Add calculations
            calculations.forEach(calc => {
                activities.push({
                    id: `calc-${calc.id}`,
                    type: 'calculation',
                    activity: calc.targetType === 'user' ? 'User Evaluation' : 
                             calc.targetType === 'group' ? 'Group Evaluation' : 'Platform Analysis',
                    target: calc.targetName,
                    targetType: calc.targetType,
                    date: calc.createdAt,
                    status: calc.status,
                    result: calc.calculatedScore ? `Score: ${calc.calculatedScore}/5` : 'Calculating...',
                    data: calc
                });
            });

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
