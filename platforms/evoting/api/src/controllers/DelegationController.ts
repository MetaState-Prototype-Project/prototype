import { Request, Response } from "express";
import { DelegationService } from "../services/DelegationService";
import { VoteService } from "../services/VoteService";

export class DelegationController {
    private delegationService: DelegationService;
    private voteService: VoteService;

    constructor() {
        this.delegationService = new DelegationService();
        this.voteService = new VoteService();
    }

    async createDelegation(req: Request, res: Response) {
        try {
            const { pollId } = req.params;
            const { delegateId } = req.body;
            const delegatorId = (req as any).user?.id;

            if (!delegatorId) {
                return res.status(401).json({ error: "Authentication required" });
            }

            if (!delegateId) {
                return res.status(400).json({ error: "Missing delegateId" });
            }

            const delegation = await this.delegationService.createDelegation(
                pollId,
                delegatorId,
                delegateId
            );

            res.status(201).json(delegation);
        } catch (error: any) {
            console.error("Error creating delegation:", error);
            res.status(400).json({ error: error.message });
        }
    }

    async revokeDelegation(req: Request, res: Response) {
        try {
            const { pollId } = req.params;
            const delegatorId = (req as any).user?.id;

            if (!delegatorId) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const delegation = await this.delegationService.revokeDelegationByPoll(
                pollId,
                delegatorId
            );

            res.json(delegation);
        } catch (error: any) {
            console.error("Error revoking delegation:", error);
            res.status(400).json({ error: error.message });
        }
    }

    async acceptDelegation(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const delegateId = (req as any).user?.id;

            if (!delegateId) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const delegation = await this.delegationService.acceptDelegation(
                id,
                delegateId
            );

            res.json(delegation);
        } catch (error: any) {
            console.error("Error accepting delegation:", error);
            res.status(400).json({ error: error.message });
        }
    }

    async rejectDelegation(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const delegateId = (req as any).user?.id;

            if (!delegateId) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const delegation = await this.delegationService.rejectDelegation(
                id,
                delegateId
            );

            res.json(delegation);
        } catch (error: any) {
            console.error("Error rejecting delegation:", error);
            res.status(400).json({ error: error.message });
        }
    }

    async getActiveDelegations(req: Request, res: Response) {
        try {
            const { pollId } = req.params;
            const delegateId = (req as any).user?.id;

            if (!delegateId) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const delegations = await this.delegationService.getActiveDelegationsForDelegate(
                pollId,
                delegateId
            );

            res.json(delegations);
        } catch (error: any) {
            console.error("Error getting active delegations:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async getPendingDelegations(req: Request, res: Response) {
        try {
            const { pollId } = req.params;
            const delegateId = (req as any).user?.id;

            if (!delegateId) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const delegations = await this.delegationService.getPendingDelegationsForDelegate(
                pollId,
                delegateId
            );

            res.json(delegations);
        } catch (error: any) {
            console.error("Error getting pending delegations:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async getAllPendingDelegations(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const delegations = await this.delegationService.getAllPendingDelegationsForUser(
                userId
            );

            res.json(delegations);
        } catch (error: any) {
            console.error("Error getting all pending delegations:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async getMyDelegation(req: Request, res: Response) {
        try {
            const { pollId } = req.params;
            const delegatorId = (req as any).user?.id;

            if (!delegatorId) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const delegation = await this.delegationService.getDelegationForDelegator(
                pollId,
                delegatorId
            );

            res.json(delegation);
        } catch (error: any) {
            console.error("Error getting my delegation:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async castDelegatedVote(req: Request, res: Response) {
        try {
            const { pollId } = req.params;
            const { delegatorId, voteData, mode } = req.body;
            const delegateId = (req as any).user?.id;

            if (!delegateId) {
                return res.status(401).json({ error: "Authentication required" });
            }

            if (!delegatorId || !voteData) {
                return res.status(400).json({ error: "Missing delegatorId or voteData" });
            }

            const vote = await this.voteService.castDelegatedVote(
                pollId,
                delegateId,
                delegatorId,
                voteData,
                mode || "normal"
            );

            res.status(201).json(vote);
        } catch (error: any) {
            console.error("Error casting delegated vote:", error);
            res.status(400).json({ error: error.message });
        }
    }

    async canPollHaveDelegation(req: Request, res: Response) {
        try {
            const { pollId } = req.params;

            const result = await this.delegationService.canPollHaveDelegation(pollId);

            res.json(result);
        } catch (error: any) {
            console.error("Error checking delegation eligibility:", error);
            res.status(500).json({ error: error.message });
        }
    }
}
