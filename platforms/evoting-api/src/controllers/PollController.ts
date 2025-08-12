import { Request, Response } from "express";
import { PollService } from "../services/PollService";

export class PollController {
    private pollService: PollService;

    constructor() {
        this.pollService = new PollService();
    }

    getAllPolls = async (req: Request, res: Response) => {
        try {
            const polls = await this.pollService.getAllPolls();
            res.json(polls);
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
            const { title, mode, visibility, options, deadline } = req.body;
            const creatorId = (req as any).user.id;

            const poll = await this.pollService.createPoll({
                title,
                mode,
                visibility,
                options,
                deadline,
                creatorId
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