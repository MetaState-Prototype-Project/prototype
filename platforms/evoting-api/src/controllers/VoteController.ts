import { Request, Response } from "express";
import { VoteService } from "../services/VoteService";

export class VoteController {
    private voteService: VoteService;

    constructor() {
        this.voteService = new VoteService();
    }

    createVote = async (req: Request, res: Response) => {
        try {
            const { pollId, optionId, points, ranks } = req.body;
            const userId = (req as any).user.id;

            const vote = await this.voteService.createVote({
                pollId,
                userId,
                optionId,
                points,
                ranks
            });

            res.status(201).json(vote);
        } catch (error) {
            console.error("Error creating vote:", error);
            if (error instanceof Error) {
                if (error.message === "User has already voted on this poll") {
                    return res.status(409).json({ error: error.message });
                }
                if (error.message === "Poll not found" || error.message === "User not found") {
                    return res.status(404).json({ error: error.message });
                }
            }
            res.status(500).json({ error: "Failed to create vote" });
        }
    };

    getVotesByPoll = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const votes = await this.voteService.getVotesByPoll(id);
            res.json(votes);
        } catch (error) {
            console.error("Error fetching votes:", error);
            res.status(500).json({ error: "Failed to fetch votes" });
        }
    };

    getUserVote = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const userId = (req as any).user.id;
            
            const vote = await this.voteService.getUserVote(id, userId);
            
            res.json({ hasVoted: !!vote, vote });
        } catch (error) {
            console.error("Error fetching user vote:", error);
            res.status(500).json({ error: "Failed to fetch user vote" });
        }
    };

    getPollResults = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const results = await this.voteService.getPollResults(id);
            res.json(results);
        } catch (error) {
            console.error("Error fetching poll results:", error);
            if (error instanceof Error && error.message === "Poll not found") {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to fetch poll results" });
        }
    };
} 