import { Request, Response } from "express";
import { PollService } from "../services/PollService";

export class PollController {
    private pollService: PollService;

    constructor() {
        this.pollService = new PollService();
    }

    getAllPolls = async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 15; // Default to 15
            const search = req.query.search as string;
            const sortField = req.query.sortField as string || "deadline";
            const sortDirection = req.query.sortDirection as "asc" | "desc" || "asc";

            // Validate pagination parameters
            if (page < 1 || limit < 1 || limit > 100) {
                return res.status(400).json({ 
                    error: "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100." 
                });
            }

            const userId = (req as any).user.id;
            const result = await this.pollService.getAllPolls(page, limit, search, sortField, sortDirection, userId);
            res.json(result);
        } catch (error) {
            console.error("Error fetching polls:", error);
            res.status(500).json({ error: "Failed to fetch polls" });
        }
    };

    getPollById = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            const poll = await this.pollService.getPollById(id);

            if (!poll) {
                return res.status(404).json({ error: "Poll not found" });
            }

            res.json(poll);
        } catch (error) {
            console.error("Error fetching poll:", error);
            res.status(500).json({ error: "Failed to fetch poll" });
        }
    };

    createPoll = async (req: Request, res: Response) => {
        try {
            const { title, mode, visibility, options, deadline, groupId } = req.body;
            const creatorId = (req as any).user.id;

            // groupId is optional - only required for system messages

            const poll = await this.pollService.createPoll({
                title,
                mode,
                visibility,
                options,
                deadline,
                creatorId,
                groupId
            });

            res.status(201).json(poll);
        } catch (error) {
            console.error("Error creating poll:", error);
            res.status(500).json({ error: "Failed to create poll" });
        }
    };

    updatePoll = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const creatorId = (req as any).user.id;

            // Check if user is the creator of the poll
            const poll = await this.pollService.getPollById(id);
            if (!poll) {
                return res.status(404).json({ error: "Poll not found" });
            }

            if (poll.creatorId !== creatorId) {
                return res.status(403).json({ error: "Not authorized to update this poll" });
            }

            const updatedPoll = await this.pollService.updatePoll(id, updateData);
            res.json(updatedPoll);
        } catch (error) {
            console.error("Error updating poll:", error);
            res.status(500).json({ error: "Failed to update poll" });
        }
    };

    deletePoll = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const creatorId = (req as any).user.id;

            // Check if user is the creator of the poll
            const poll = await this.pollService.getPollById(id);
            if (!poll) {
                return res.status(404).json({ error: "Poll not found" });
            }

            if (poll.creatorId !== creatorId) {
                return res.status(403).json({ error: "Not authorized to delete this poll" });
            }

            const success = await this.pollService.deletePoll(id);
            if (success) {
                res.status(204).send();
            } else {
                res.status(500).json({ error: "Failed to delete poll" });
            }
        } catch (error) {
            console.error("Error deleting poll:", error);
            res.status(500).json({ error: "Failed to delete poll" });
        }
    };

    getPollsByCreator = async (req: Request, res: Response) => {
        try {
            const creatorId = (req as any).user.id;
            const polls = await this.pollService.getPollsByCreator(creatorId);
            res.json(polls);
        } catch (error) {
            console.error("Error fetching user polls:", error);
            res.status(500).json({ error: "Failed to fetch user polls" });
        }
    };
} 