import { Request, Response } from "express";
import { CalculationService } from "../services/CalculationService";
import { authGuard } from "../middleware/auth";

export class CalculationController {
    private calculationService: CalculationService;

    constructor() {
        this.calculationService = new CalculationService();
    }

    calculateReputation = async (req: Request, res: Response) => {
        try {
            const { targetType, targetId, targetName, userValues } = req.body;
            const calculatorId = req.user!.id;

            if (!targetType || !targetId || !targetName || !userValues) {
                return res.status(400).json({ error: "Missing required fields" });
            }

            // Create calculation record
            const calculation = await this.calculationService.createCalculation({
                targetType,
                targetId,
                targetName,
                userValues,
                calculatorId
            });

            // Calculate reputation synchronously
            const result = await this.calculationService.calculateReputation(calculation.id);

            const details = result.calculationDetails ? JSON.parse(result.calculationDetails) : {};

            res.json({
                score: result.calculatedScore?.toString() || "0",
                analysis: details.explanation || "No analysis available",
                targetName: result.targetName,
                calculationId: result.id
            });
        } catch (error) {
            console.error("Error calculating reputation:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getCalculationResult = async (req: Request, res: Response) => {
        try {
            const { calculationId } = req.params;
            const userId = req.user!.id;

            const calculation = await this.calculationService.getCalculationById(calculationId);

            if (!calculation) {
                return res.status(404).json({ error: "Calculation not found" });
            }

            // Check if user is authorized to view this calculation
            if (calculation.calculatorId !== userId) {
                return res.status(403).json({ error: "Not authorized to view this calculation" });
            }

            const details = calculation.calculationDetails ? JSON.parse(calculation.calculationDetails) : {};

            res.json({
                id: calculation.id,
                targetType: calculation.targetType,
                targetName: calculation.targetName,
                userValues: calculation.userValues,
                calculatedScore: calculation.calculatedScore,
                status: calculation.status,
                details: details,
                createdAt: calculation.createdAt,
                updatedAt: calculation.updatedAt
            });
        } catch (error) {
            console.error("Error getting calculation result:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getUserCalculations = async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const calculations = await this.calculationService.getUserCalculations(userId);

            res.json({
                calculations: calculations.map(calc => {
                    const details = calc.calculationDetails ? JSON.parse(calc.calculationDetails) : {};
                    return {
                        id: calc.id,
                        targetType: calc.targetType,
                        targetName: calc.targetName,
                        calculatedScore: calc.calculatedScore,
                        status: calc.status,
                        details: details,
                        createdAt: calc.createdAt,
                        updatedAt: calc.updatedAt
                    };
                })
            });
        } catch (error) {
            console.error("Error getting user calculations:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
