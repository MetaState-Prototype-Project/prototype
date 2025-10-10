import { Request, Response } from "express";
import { AIMatchingService } from "../services/AIMatchingService";
import { MatchStatus } from "../database/entities/Match";

export class MatchController {
    private aiMatchingService: AIMatchingService;

    constructor() {
        this.aiMatchingService = new AIMatchingService();
    }

    triggerMatching = async (req: Request, res: Response) => {
        try {
            console.log("🚀 Manual AI matching triggered");
            await this.aiMatchingService.findMatches();
            res.json({ 
                success: true, 
                message: "AI matching process completed successfully",
                timestamp: new Date().toISOString()
            });
        } catch (error: any) {
            console.error("Error in manual AI matching:", error);
            res.status(500).json({ 
                success: false, 
                error: "Failed to run AI matching process",
                details: error.message 
            });
        }
    };

    getMatchingStats = async (req: Request, res: Response) => {
        try {
            const stats = await this.aiMatchingService.getMatchingStats();
            res.json(stats);
        } catch (error: any) {
            console.error("Error getting matching stats:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getUserMatches = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const matches = await this.aiMatchingService.getMatchesForUser(userId);
            res.json(matches);
        } catch (error) {
            console.error("Error fetching user matches:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    updateMatchStatus = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { id } = req.params;
            const { status } = req.body;

            if (!Object.values(MatchStatus).includes(status)) {
                return res.status(400).json({ error: "Invalid match status" });
            }

            const match = await this.aiMatchingService.updateMatchStatus(id, userId, status);
            res.json(match);
        } catch (error: any) {
            console.error("Error updating match status:", error);
            if (error.message === "Match not found or access denied") {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
