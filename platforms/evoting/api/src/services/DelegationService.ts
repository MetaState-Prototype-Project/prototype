import { Repository, In } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Delegation, DelegationStatus } from "../database/entities/Delegation";
import { Poll } from "../database/entities/Poll";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Vote } from "../database/entities/Vote";
import { MessageService } from "./MessageService";

export class DelegationService {
    private delegationRepository: Repository<Delegation>;
    private pollRepository: Repository<Poll>;
    private userRepository: Repository<User>;
    private groupRepository: Repository<Group>;
    private voteRepository: Repository<Vote>;
    private messageService: MessageService;

    constructor() {
        this.delegationRepository = AppDataSource.getRepository(Delegation);
        this.pollRepository = AppDataSource.getRepository(Poll);
        this.userRepository = AppDataSource.getRepository(User);
        this.groupRepository = AppDataSource.getRepository(Group);
        this.voteRepository = AppDataSource.getRepository(Vote);
        this.messageService = new MessageService();
    }

    private async isUserGroupMember(groupId: string, userId: string): Promise<boolean> {
        const group = await this.groupRepository
            .createQueryBuilder("group")
            .leftJoin("group.members", "member")
            .leftJoin("group.admins", "admin")
            .leftJoin("group.participants", "participant")
            .where("group.id = :groupId", { groupId })
            .andWhere(
                "(member.id = :userId OR admin.id = :userId OR participant.id = :userId)",
                { userId }
            )
            .getOne();

        return !!group;
    }

    async createDelegation(
        pollId: string,
        delegatorId: string,
        delegateId: string
    ): Promise<Delegation> {
        const poll = await this.pollRepository.findOne({
            where: { id: pollId },
        });

        if (!poll) {
            throw new Error("Poll not found");
        }

        if (poll.visibility === "private" && poll.mode === "normal") {
            throw new Error(
                "Delegation is not available for private simple voting (cryptographically protected)"
            );
        }

        if (!poll.groupId) {
            throw new Error("Delegation is only available for group polls");
        }

        if (delegatorId === delegateId) {
            throw new Error("Cannot delegate vote to yourself");
        }

        const [delegator, delegate] = await Promise.all([
            this.userRepository.findOne({ where: { id: delegatorId } }),
            this.userRepository.findOne({ where: { id: delegateId } }),
        ]);

        if (!delegator) {
            throw new Error("Delegator not found");
        }

        if (!delegate) {
            throw new Error("Delegate not found");
        }

        const [delegatorIsMember, delegateIsMember] = await Promise.all([
            this.isUserGroupMember(poll.groupId, delegatorId),
            this.isUserGroupMember(poll.groupId, delegateId),
        ]);

        if (!delegatorIsMember) {
            throw new Error("Delegator is not a member of the poll's group");
        }

        if (!delegateIsMember) {
            throw new Error("Delegate is not a member of the poll's group");
        }

        const existingVote = await this.voteRepository.findOne({
            where: { pollId, userId: delegatorId },
        });

        if (existingVote) {
            throw new Error("Cannot delegate: you have already voted on this poll");
        }

        const existingDelegation = await this.delegationRepository.findOne({
            where: {
                pollId,
                delegatorId,
                status: In(["pending", "active"]),
            },
        });

        if (existingDelegation) {
            throw new Error(
                "You already have an active or pending delegation for this poll"
            );
        }

        const delegation = this.delegationRepository.create({
            pollId,
            delegatorId,
            delegateId,
            status: "pending",
        });

        const savedDelegation = await this.delegationRepository.save(delegation);

        await this.messageService.createSystemMessage({
            text: `eVoting Platform: Delegation Request\n\n${delegator.name || delegator.ename} has requested to delegate their vote to ${delegate.name || delegate.ename} for poll "${poll.title}"`,
            groupId: poll.groupId,
            voteId: pollId,
        });

        return savedDelegation;
    }

    async acceptDelegation(
        delegationId: string,
        delegateId: string
    ): Promise<Delegation> {
        const delegation = await this.delegationRepository.findOne({
            where: { id: delegationId },
            relations: ["poll", "delegator", "delegate"],
        });

        if (!delegation) {
            throw new Error("Delegation not found");
        }

        if (delegation.delegateId !== delegateId) {
            throw new Error("Only the delegate can accept this delegation");
        }

        if (delegation.status !== "pending") {
            throw new Error(`Cannot accept delegation with status: ${delegation.status}`);
        }

        delegation.status = "active";
        const savedDelegation = await this.delegationRepository.save(delegation);

        if (delegation.poll?.groupId) {
            const delegatorName = delegation.delegator?.name || delegation.delegator?.ename || "Unknown";
            const delegateName = delegation.delegate?.name || delegation.delegate?.ename || "Unknown";
            
            await this.messageService.createSystemMessage({
                text: `eVoting Platform: Delegation Accepted\n\n${delegateName} has accepted ${delegatorName}'s vote delegation for poll "${delegation.poll.title}"`,
                groupId: delegation.poll.groupId,
                voteId: delegation.pollId,
            });
        }

        return savedDelegation;
    }

    async rejectDelegation(
        delegationId: string,
        delegateId: string
    ): Promise<Delegation> {
        const delegation = await this.delegationRepository.findOne({
            where: { id: delegationId },
            relations: ["poll", "delegator", "delegate"],
        });

        if (!delegation) {
            throw new Error("Delegation not found");
        }

        if (delegation.delegateId !== delegateId) {
            throw new Error("Only the delegate can reject this delegation");
        }

        if (delegation.status !== "pending") {
            throw new Error(`Cannot reject delegation with status: ${delegation.status}`);
        }

        delegation.status = "rejected";
        const savedDelegation = await this.delegationRepository.save(delegation);

        if (delegation.poll?.groupId) {
            const delegatorName = delegation.delegator?.name || delegation.delegator?.ename || "Unknown";
            const delegateName = delegation.delegate?.name || delegation.delegate?.ename || "Unknown";
            
            await this.messageService.createSystemMessage({
                text: `eVoting Platform: Delegation Declined\n\n${delegateName} has declined ${delegatorName}'s vote delegation for poll "${delegation.poll.title}"`,
                groupId: delegation.poll.groupId,
                voteId: delegation.pollId,
            });
        }

        return savedDelegation;
    }

    async revokeDelegation(
        delegationId: string,
        delegatorId: string
    ): Promise<Delegation> {
        const delegation = await this.delegationRepository.findOne({
            where: { id: delegationId },
            relations: ["poll", "delegator", "delegate"],
        });

        if (!delegation) {
            throw new Error("Delegation not found");
        }

        if (delegation.delegatorId !== delegatorId) {
            throw new Error("Only the delegator can revoke this delegation");
        }

        if (delegation.status === "used") {
            throw new Error("Cannot revoke delegation: vote has already been cast");
        }

        if (delegation.status === "revoked") {
            throw new Error("Delegation is already revoked");
        }

        delegation.status = "revoked";
        const savedDelegation = await this.delegationRepository.save(delegation);

        if (delegation.poll?.groupId) {
            const delegatorName = delegation.delegator?.name || delegation.delegator?.ename || "Unknown";
            const delegateName = delegation.delegate?.name || delegation.delegate?.ename || "Unknown";
            
            await this.messageService.createSystemMessage({
                text: `eVoting Platform: Delegation Revoked\n\n${delegatorName} has revoked their vote delegation to ${delegateName} for poll "${delegation.poll.title}"`,
                groupId: delegation.poll.groupId,
                voteId: delegation.pollId,
            });
        }

        return savedDelegation;
    }

    async revokeDelegationByPoll(
        pollId: string,
        delegatorId: string
    ): Promise<Delegation> {
        const delegation = await this.delegationRepository.findOne({
            where: {
                pollId,
                delegatorId,
                status: In(["pending", "active"]),
            },
        });

        if (!delegation) {
            throw new Error("No active delegation found for this poll");
        }

        return this.revokeDelegation(delegation.id, delegatorId);
    }

    async getDelegationsForDelegate(
        pollId: string,
        delegateId: string,
        status?: DelegationStatus | DelegationStatus[]
    ): Promise<Delegation[]> {
        const whereCondition: any = {
            pollId,
            delegateId,
        };

        if (status) {
            whereCondition.status = Array.isArray(status) ? In(status) : status;
        }

        return await this.delegationRepository.find({
            where: whereCondition,
            relations: ["delegator", "delegate", "poll"],
            order: { createdAt: "DESC" },
        });
    }

    async getActiveDelegationsForDelegate(
        pollId: string,
        delegateId: string
    ): Promise<Delegation[]> {
        return this.getDelegationsForDelegate(pollId, delegateId, "active");
    }

    async getActiveAndUsedDelegationsForDelegate(
        pollId: string,
        delegateId: string
    ): Promise<Delegation[]> {
        return this.getDelegationsForDelegate(pollId, delegateId, ["active", "used"]);
    }

    async getPendingDelegationsForDelegate(
        pollId: string,
        delegateId: string
    ): Promise<Delegation[]> {
        return this.getDelegationsForDelegate(pollId, delegateId, "pending");
    }

    async getAllPendingDelegationsForUser(userId: string): Promise<Delegation[]> {
        return await this.delegationRepository.find({
            where: {
                delegateId: userId,
                status: "pending",
            },
            relations: ["delegator", "delegate", "poll"],
            order: { createdAt: "DESC" },
        });
    }

    async getDelegationForDelegator(
        pollId: string,
        delegatorId: string
    ): Promise<Delegation | null> {
        return await this.delegationRepository.findOne({
            where: {
                pollId,
                delegatorId,
                status: In(["pending", "active", "used"]),
            },
            relations: ["delegator", "delegate", "poll"],
        });
    }

    async markDelegationUsed(delegationId: string): Promise<Delegation> {
        const delegation = await this.delegationRepository.findOne({
            where: { id: delegationId },
        });

        if (!delegation) {
            throw new Error("Delegation not found");
        }

        if (delegation.status !== "active") {
            throw new Error(`Cannot mark delegation as used with status: ${delegation.status}`);
        }

        delegation.status = "used";
        return await this.delegationRepository.save(delegation);
    }

    async getDelegationById(delegationId: string): Promise<Delegation | null> {
        return await this.delegationRepository.findOne({
            where: { id: delegationId },
            relations: ["delegator", "delegate", "poll"],
        });
    }

    async canPollHaveDelegation(pollId: string): Promise<{ canDelegate: boolean; reason?: string }> {
        const poll = await this.pollRepository.findOne({
            where: { id: pollId },
        });

        if (!poll) {
            return { canDelegate: false, reason: "Poll not found" };
        }

        if (!poll.groupId) {
            return { canDelegate: false, reason: "Delegation is only available for group polls" };
        }

        if (poll.visibility === "private" && poll.mode === "normal") {
            return {
                canDelegate: false,
                reason: "Delegation is not available for private simple voting (cryptographically protected)",
            };
        }

        return { canDelegate: true };
    }
}

export default new DelegationService();
