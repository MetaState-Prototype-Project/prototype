import type { Request, Response } from "express";
import type {
    PointVoteData,
    RankVoteData,
    Vote,
} from "../database/entities/Vote";
import {
    type PollService,
    isValidPointVote,
    isValidRankVote,
} from "../services/poll.service";

export class PollController {
    constructor(private readonly pollService: PollService) {}

    async createPoll(req: Request, res: Response) {
        const { title, mode, visibility, options, deadline } = req.body;
        if (!title || !mode || !visibility || !options) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        if (!Array.isArray(options) || options.length === 0) {
            return res
                .status(400)
                .json({ error: "Options must be a non-empty array" });
        }

        if (deadline && Number.isNaN(new Date(deadline).getTime())) {
            return res.status(400).json({ error: "Invalid deadline date" });
        }

        try {
            const poll = await this.pollService.createPoll(
                title,
                mode,
                visibility,
                options,
                deadline ? new Date(deadline) : undefined,
            );
            res.status(201).json(poll);
        } catch (err: unknown) {
            res.status(400).json({ error: (err as Error).message });
        }
    }

    async getPoll(req: Request, res: Response) {
        try {
            const poll = await this.pollService.getPollById(req.params.id);
            if (!poll) return res.status(404).json({ error: "Poll not found" });
            res.json(poll);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }

    async castVote(req: Request, res: Response) {
        const { data, pollId } = req.body;
        if (!data) {
            return res.status(400).json({ error: "Vote data is required" });
        }
        if (!pollId) {
            return res.status(400).json({ error: "Poll ID is required" });
        }

        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const poll = await this.pollService.getPollById(pollId);
        if (!poll) {
            return res.status(404).json({ error: "Poll not found" });
        }

        const pollOptions = poll.options;

        if (poll.mode === "normal" && !Array.isArray(data)) {
            return res
                .status(400)
                .json({ error: "Invalid vote data for normal mode" });
        }

        if (poll.mode === "point" && !isValidPointVote(data, pollOptions)) {
            return res
                .status(400)
                .json({ error: "Invalid vote data for point mode" });
        }

        if (poll.mode === "rank" && !isValidRankVote(data, pollOptions)) {
            return res
                .status(400)
                .json({ error: "Invalid vote data for rank mode" });
        }

        try {
            const vote = await this.pollService.castVote(
                pollId,
                req.user.id,
                data,
            );
            res.status(201).json(vote);
        } catch (err: unknown) {
            res.status(400).json({ error: (err as Error).message });
        }
    }

    // async getResults(req: Request, res: Response) {
    //     try {
    //         const poll = await this.pollService.getPollById(req.params.id);
    //         if (!poll) return res.status(404).json({ error: "Poll not found" });

    //         const votes = await this.pollService.getVotes(poll.id);
    //         const results: Record<string, number> = {};

    //         switch (poll.mode) {
    //             case "normal":
    //                 for (const vote of votes) {
    //                     for (const opt of vote.data as string[]) {
    //                         results[opt] = (results[opt] ?? 0) + 1;
    //                     }
    //                 }
    //                 break;

    //             case "point":
    //                 for (const vote of votes) {
    //                     for (const {
    //                         option,
    //                         points,
    //                     } of vote.data as PointVoteData) {
    //                         results[option] = (results[option] ?? 0) + points;
    //                     }
    //                 }
    //                 break;

    //             case "rank":
    //                 // In rank mode, lower points = higher rank
    //                 for (const vote of votes) {
    //                     for (const {
    //                         option,
    //                         points,
    //                     } of vote.data as RankVoteData) {
    //                         results[option] = (results[option] ?? 0) + points;
    //                     }
    //                 }
    //                 // Sort options by ascending total score (lower is better)
    //                 res.json({
    //                     mode: poll.mode,
    //                     results: Object.entries(results)
    //                         .sort((a, b) => a[1] - b[1])
    //                         .map(([option, score]) => ({ option, score })),
    //                 });
    //                 return;

    //             default:
    //                 return res.status(400).json({ error: "Invalid poll mode" });
    //         }

    //         // For normal and point, sort descending (higher is better)
    //         res.json({
    //             mode: poll.mode,
    //             results: Object.entries(results)
    //                 .sort((a, b) => b[1] - a[1])
    //                 .map(([option, score]) => ({ option, score })),
    //         });
    //     } catch (err: any) {
    //         res.status(400).json({ error: err.message });
    //     }
    // }

    // async getPollsByUser(req: Request, res: Response) {
    //     try {
    //         const polls = await this.pollService.getPollsByUser(req.user?.id);
    //         res.json(polls);
    //     } catch (err: any) {
    //         res.status(500).json({ error: err.message });
    //     }
    // }

    // async deletePoll(req: Request, res: Response) {
    //     try {
    //         await this.pollService.deletePoll(req.params.id, req.user?.id);
    //         res.status(204).send();
    //     } catch (err: any) {
    //         res.status(400).json({ error: err.message });
    //     }
    // }
}
