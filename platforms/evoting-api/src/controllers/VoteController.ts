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

    // NEW: Blind voting endpoints
    submitBlindVote = async (req: Request, res: Response) => {
        try {
            const { pollId, commitment, proof } = req.body;
            const userId = (req as any).user.id;

            const voteRecord = await this.voteService.submitBlindVote(pollId, userId, commitment, proof);
            res.status(201).json(voteRecord);
        } catch (error) {
            console.error("Error submitting blind vote:", error);
            if (error instanceof Error) {
                if (error.message === "User has already submitted a vote for this poll") {
                    return res.status(409).json({ error: error.message });
                }
                if (error.message === "Poll not found" || error.message === "User not found") {
                    return res.status(404).json({ error: error.message });
                }
                if (error.message === "Blind voting only allowed for private polls") {
                    return res.status(400).json({ error: error.message });
                }
            }
            res.status(500).json({ error: "Failed to submit blind vote" });
        }
    };

    // Get poll details for blind voting (used by eID wallet)
    getPollForBlindVoting = async (req: Request, res: Response) => {
        try {
            const { pollId } = req.params;
            
            // Get poll details without requiring authentication (eID wallet needs this)
            const poll = await this.voteService.getPollForBlindVoting(pollId);
            
            if (!poll) {
                return res.status(404).json({ error: "Poll not found" });
            }

            res.json(poll);
        } catch (error) {
            console.error("Error fetching poll for blind voting:", error);
            res.status(500).json({ error: "Failed to fetch poll details" });
        }
    };

    revealBlindVote = async (req: Request, res: Response) => {
        try {
            const { pollId, actualVote } = req.body;
            const userId = (req as any).user.id;

            const vote = await this.voteService.revealBlindVote(pollId, userId, actualVote);
            res.json(vote);
        } catch (error) {
            console.error("Error revealing blind vote:", error);
            if (error instanceof Error) {
                if (error.message === "Blind vote not found") {
                    return res.status(404).json({ error: error.message });
                }
                if (error.message === "Vote is not a blind vote") {
                    return res.status(400).json({ error: error.message });
                }
                if (error.message === "Vote has already been revealed") {
                    return res.status(409).json({ error: error.message });
                }
                if (error.message === "Blind vote must be binary (0 or 1)") {
                    return res.status(400).json({ error: error.message });
                }
                if (error.message === "Revealed vote does not match stored vote") {
                    return res.status(400).json({ error: error.message });
                }
            }
            res.status(500).json({ error: "Failed to reveal blind vote" });
        }
    };

    tallyBlindVotes = async (req: Request, res: Response) => {
        try {
            const { pollId } = req.params;
            const results = await this.voteService.tallyBlindVotes(pollId);
            res.json(results);
        } catch (error) {
            console.error("Error tallying blind votes:", error);
            if (error instanceof Error && error.message === "Blind vote tallying only allowed for private polls") {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to tally blind votes" });
        }
    };
} 