import { Request, Response } from "express";
import { VoteService } from "../services/VoteService";

export class VoteController {
  private voteService: VoteService;

  constructor() {
    this.voteService = new VoteService();
  }

  // ===== NON-BLIND VOTING METHODS (for normal/point/rank modes) =====

  async createVote(req: Request, res: Response) {
    try {
      // Handle both cases: pollId from URL params or from request body
      const pollId = req.params.pollId || req.body.pollId;
      const { userId, voteData, mode } = req.body;

      if (!pollId || !userId || !voteData) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await this.voteService.createVote(pollId, userId, voteData, mode);
      res.json(result);
    } catch (error) {
      console.error("Error creating vote:", error);
      res.status(500).json({ error: "Failed to create vote" });
    }
  }

  async getVotesByPoll(req: Request, res: Response) {
    try {
      const { pollId } = req.params;
      const votes = await this.voteService.getVotesByPoll(pollId);
      res.json(votes);
    } catch (error) {
      console.error("Error getting votes by poll:", error);
      res.status(500).json({ error: "Failed to get votes" });
    }
  }

  async getUserVote(req: Request, res: Response) {
    try {
      const { pollId, userId } = req.params;
      // If userId is not in URL params, try to get it from query params or request body
      const actualUserId = userId || req.query.userId as string || req.body.userId;
      
      if (!actualUserId) {
        return res.status(400).json({ error: "Missing userId. Please provide userId as a query parameter or in the request body." });
      }

      const vote = await this.voteService.getUserVote(pollId, actualUserId);
      res.json(vote);
    } catch (error) {
      console.error("Error getting user vote:", error);
      res.status(500).json({ error: "Failed to get user vote" });
    }
  }

  async getPollResults(req: Request, res: Response) {
    try {
      const { pollId } = req.params;
      const results = await this.voteService.getPollResults(pollId);
      res.json(results);
    } catch (error) {
      console.error("Error getting poll results:", error);
      res.status(500).json({ error: "Failed to get poll results" });
    }
  }

  // ===== BLIND VOTING METHODS =====

    // Submit a blind vote with per-option commitments and anchors (PRIVACY PRESERVING)
    async submitBlindVote(req: Request, res: Response) {
        try {
            const { pollId } = req.params;
            const { voterId, commitments, anchors } = req.body;

            if (!voterId || !commitments || !anchors) {
                return res.status(400).json({ 
                    error: 'Missing required fields: voterId, commitments, anchors' 
                });
            }

            const result = await this.voteService.submitBlindVote(pollId, voterId, {
                commitments,
                anchors
            });

            res.json(result);
        } catch (error: any) {
            console.error('❌ Error in submitBlindVote:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Register a voter for blind voting
    async registerBlindVoteVoter(req: Request, res: Response) {
        try {
            const { pollId } = req.params;
            const { voterId } = req.body;

            if (!voterId) {
                return res.status(400).json({ error: 'Missing voterId' });
            }

            const result = await this.voteService.registerBlindVoteVoter(pollId, voterId);
            res.json(result);
        } catch (error: any) {
            console.error('❌ Error in registerBlindVoteVoter:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Generate vote data for eID wallet
    async generateVoteData(req: Request, res: Response) {
        try {
            const { pollId } = req.params;
            const { voterId, chosenOptionId } = req.body;

            if (!voterId || !chosenOptionId) {
                return res.status(400).json({ 
                    error: 'Missing required fields: voterId, chosenOptionId' 
                });
            }

            const result = await this.voteService.generateVoteData(pollId, voterId, chosenOptionId);
            res.json(result);
        } catch (error: any) {
            console.error('❌ Error in generateVoteData:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Tally blind votes
    async tallyBlindVotes(req: Request, res: Response) {
        try {
            const { pollId } = req.params;
            const result = await this.voteService.tallyBlindVotes(pollId);
            res.json(result);
        } catch (error: any) {
            console.error('❌ Error in tallyBlindVotes:', error);
            res.status(500).json({ error: error.message });
        }
    }
} 