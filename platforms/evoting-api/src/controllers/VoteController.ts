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
            const { sessionId, commitment, userW3id } = req.body;
            
            if (!sessionId || !commitment || !userW3id) {
                return res.status(400).json({ error: "Missing required fields: sessionId, commitment, userW3id" });
            }

            // Look up the session
            if (!(global as any).blindVoteSessions) {
                return res.status(404).json({ error: "No blind vote sessions found" });
            }

            const session = (global as any).blindVoteSessions.get(sessionId);
            if (!session) {
                return res.status(404).json({ error: "Invalid or expired session" });
            }

            // Check if session is expired
            if (session.createdAt < new Date(Date.now() - 5 * 60 * 1000)) {
                (global as any).blindVoteSessions.delete(sessionId);
                return res.status(410).json({ error: "Session expired" });
            }

            // Get the user from the session
            const user = await this.voteService.getUserById(session.userId);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            // Validate that the w3id matches the user's ename (stripping @ prefix)
            const userEname = user.ename?.replace(/^@/, '') || '';
            const submittedW3id = userW3id.replace(/^@/, '');
            
            if (userEname !== submittedW3id) {
                console.error(`W3ID mismatch: session user ${userEname} vs submitted ${submittedW3id}`);
                return res.status(403).json({ error: "W3ID validation failed" });
            }

            console.log(`✅ W3ID validated: ${userEname} matches ${submittedW3id}`);

            // Submit the blind vote using the session data
            // IMPORTANT: We only store the commitment and proof, NOT the actual vote choice
            const voteRecord = await this.voteService.submitBlindVote(session.pollId, session.userId, commitment, null); // Removed proof
            
            // Mark session as completed
            session.status = 'completed';
            session.voteId = voteRecord.id;
            
            // Notify all SSE clients about the blind vote update
            VoteController.notifyBlindVoteUpdate(session.pollId, {
                type: 'blind_vote_submitted',
                pollId: session.pollId,
                sessionId: sessionId,
                voteId: voteRecord.id,
                timestamp: new Date()
            });
            
            res.status(201).json({ 
                message: "Blind vote submitted successfully",
                voteId: voteRecord.id,
                sessionId
            });
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
            const { id } = req.params;
            
            // Get poll details without requiring authentication (eID wallet needs this)
            const poll = await this.voteService.getPollForBlindVoting(id);
            
            if (!poll) {
                return res.status(404).json({ error: "Poll not found" });
            }

            res.json(poll);
        } catch (error) {
            console.error("Error fetching poll for blind voting:", error);
            res.status(500).json({ error: "Failed to fetch poll details" });
        }
    };

    tallyBlindVotes = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const results = await this.voteService.tallyBlindVotes(id);
            res.json(results);
        } catch (error) {
            console.error("Error tallying blind votes:", error);
            if (error instanceof Error && error.message === "Blind vote tallying only allowed for private polls") {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to tally blind votes" });
        }
    };

    // NEW: Create a blind vote session (no auth required)
    createBlindVoteSession = async (req: Request, res: Response) => {
        try {
            const { pollId, userId } = req.body;
            
            if (!pollId || !userId) {
                return res.status(400).json({ error: "Missing pollId or userId" });
            }

            // Verify the poll exists and is private
            const poll = await this.voteService.getPollForBlindVoting(pollId);
            if (!poll) {
                return res.status(404).json({ error: "Poll not found" });
            }
            if (poll.visibility !== "private") {
                return res.status(400).json({ error: "Blind voting only allowed for private polls" });
            }

            // Create a session for blind voting
            const sessionId = `blind-vote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Store the session in memory (in production, use Redis or database)
            // This maps sessionId to { pollId, userId, createdAt }
            if (!(global as any).blindVoteSessions) {
                (global as any).blindVoteSessions = new Map();
            }
            
            (global as any).blindVoteSessions.set(sessionId, {
                pollId,
                userId,
                createdAt: new Date(),
                status: 'pending'
            });

            // Clean up old sessions (older than 5 minutes)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            for (const [key, session] of (global as any).blindVoteSessions.entries()) {
                if (session.createdAt < fiveMinutesAgo) {
                    (global as any).blindVoteSessions.delete(key);
                }
            }

            res.json({ 
                sessionId,
                pollId,
                userId,
                platformUrl: process.env.PUBLIC_EVOTING_BASE_URL || 'http://localhost:3001',
                expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
            });
        } catch (error) {
            console.error("Error creating blind vote session:", error);
            res.status(500).json({ error: "Failed to create blind vote session" });
        }
    };

    // NEW: Check if user has already voted in a poll
    checkUserVoteStatus = async (req: Request, res: Response) => {
        try {
            const { pollId, userId } = req.params;
            
            if (!pollId || !userId) {
                return res.status(400).json({ error: "Missing pollId or userId" });
            }

            const hasVoted = await this.voteService.hasUserVoted(pollId, userId);
            
            res.json({ 
                pollId,
                userId,
                hasVoted,
                message: hasVoted ? "User has already voted" : "User has not voted yet"
            });
        } catch (error) {
            console.error("Error checking user vote status:", error);
            res.status(500).json({ error: "Failed to check user vote status" });
        }
    };

    // NEW: Register a voter for blind voting (no auth required)
    registerBlindVoteVoter = async (req: Request, res: Response) => {
        try {
            const { pollId, voterId } = req.body;
            
            if (!pollId || !voterId) {
                return res.status(400).json({ error: "Missing pollId or voterId" });
            }

            // Register the voter in the backend's voting system for this specific poll
            const registration = await this.voteService.registerBlindVoteVoter(pollId, voterId);
            
            res.json({ 
                success: true,
                pollId,
                voterId,
                message: "Voter registered successfully for blind voting"
            });
        } catch (error) {
            console.error("Error registering blind vote voter:", error);
            if (error instanceof Error && error.message.includes("already registered")) {
                return res.status(409).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to register voter for blind voting" });
        }
    };

    // NEW: SSE endpoint for blind vote updates
    blindVoteSSE = async (req: Request, res: Response) => {
        try {
            const { pollId } = req.params;
            
            if (!pollId) {
                return res.status(400).json({ error: "Missing pollId" });
            }

            // Set up SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            // Send initial connection message
            res.write(`data: ${JSON.stringify({ type: 'connected', pollId })}\n\n`);

            // Store the response object for later use
            if (!(global as any).blindVoteSSEClients) {
                (global as any).blindVoteSSEClients = new Map();
            }
            
            if (!(global as any).blindVoteSSEClients.has(pollId)) {
                (global as any).blindVoteSSEClients.set(pollId, new Set());
            }
            
            (global as any).blindVoteSSEClients.get(pollId).add(res);

            // Handle client disconnect
            req.on('close', () => {
                if ((global as any).blindVoteSSEClients.has(pollId)) {
                    (global as any).blindVoteSSEClients.get(pollId).delete(res);
                    if ((global as any).blindVoteSSEClients.get(pollId).size === 0) {
                        (global as any).blindVoteSSEClients.delete(pollId);
                    }
                }
            });

            // Keep connection alive
            const keepAlive = setInterval(() => {
                res.write(`data: ${JSON.stringify({ type: 'keepalive', timestamp: Date.now() })}\n\n`);
            }, 30000); // Send keepalive every 30 seconds

            req.on('close', () => {
                clearInterval(keepAlive);
            });

        } catch (error) {
            console.error("Error setting up blind vote SSE:", error);
            res.status(500).json({ error: "Failed to set up SSE connection" });
        }
    };

    // Helper method to notify all SSE clients about blind vote updates
    static notifyBlindVoteUpdate(pollId: string, data: any) {
        if ((global as any).blindVoteSSEClients && (global as any).blindVoteSSEClients.has(pollId)) {
            const clients = (global as any).blindVoteSSEClients.get(pollId);
            clients.forEach((client: any) => {
                try {
                    client.write(`data: ${JSON.stringify(data)}\n\n`);
                } catch (error) {
                    console.error("Error sending SSE message:", error);
                    // Remove disconnected client
                    clients.delete(client);
                }
            });
        }
    }
} 