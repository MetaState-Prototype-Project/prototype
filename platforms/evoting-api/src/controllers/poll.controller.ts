import type { Request, Response } from "express";
import type { PollService } from "../services/poll.service";

export class PollController {
    constructor(private readonly pollService: PollService) {}

    async createPoll(req: Request, res: Response) {
        try {
            const poll = await this.pollService.createPoll(
                req.body,
                req.user?.id,
            );
            res.status(201).json(poll);
        } catch (err: any) {
            res.status(400).json({ error: err.message });
        }
    }

    async getPoll(req: Request, res: Response) {
        try {
            const poll = await this.pollService.getPollById(req.params.id);
            if (!poll) return res.status(404).json({ error: "Poll not found" });
            res.json(poll);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    }

    async castVote(req: Request, res: Response) {
        try {
            const vote = await this.pollService.castVote(
                req.params.id,
                req.user?.id,
                req.body,
            );
            res.status(201).json(vote);
        } catch (err: any) {
            res.status(400).json({ error: err.message });
        }
    }

    async getResults(req: Request, res: Response) {
        try {
            const results = await this.pollService.getResults(req.params.id);
            res.json(results);
        } catch (err: any) {
            res.status(400).json({ error: err.message });
        }
    }

    async getPollsByUser(req: Request, res: Response) {
        try {
            const polls = await this.pollService.getPollsByUser(req.user?.id);
            res.json(polls);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    }

    async deletePoll(req: Request, res: Response) {
        try {
            await this.pollService.deletePoll(req.params.id, req.user?.id);
            res.status(204).send();
        } catch (err: any) {
            res.status(400).json({ error: err.message });
        }
    }
}
