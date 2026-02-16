import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Poll } from "../database/entities/Poll";
import { MessageService } from "./MessageService";
import { VoteService } from "./VoteService";

export class DeadlineCheckService {
    private pollRepository: Repository<Poll>;
    private messageService: MessageService;
    private voteService: VoteService;

    constructor() {
        this.pollRepository = AppDataSource.getRepository(Poll);
        this.messageService = new MessageService();
        this.voteService = new VoteService();
    }

    /**
     * Check for polls with deadlines that have passed and send system messages
     * This method is designed to be called by a cron job every 5 minutes
     */
    async checkExpiredPolls(): Promise<void> {
        const now = new Date();
        
        try {
            console.log(`[${now.toISOString()}] 🔍 Checking for expired polls...`);
            
            // Find all polls with deadlines that have passed and haven't had deadline messages sent yet
            const expiredPolls = await this.pollRepository
                .createQueryBuilder("poll")
                .leftJoinAndSelect("poll.creator", "creator")
                .where("poll.deadline < :now", { now })
                .andWhere("poll.deadlineMessageSent = :sent", { sent: false })
                .andWhere("poll.deadline IS NOT NULL")
                .getMany();

            console.log(`[${now.toISOString()}] 📊 Found ${expiredPolls.length} expired polls that need deadline messages`);
            
            if (expiredPolls.length === 0) {
                console.log(`[${now.toISOString()}] ✅ No expired polls found, nothing to process`);
                return;
            }

            for (const poll of expiredPolls) {
                try {
                    await this.processExpiredPoll(poll);
                } catch (error) {
                    console.error(`Failed to process expired poll ${poll.id}:`, error);
                }
            }
        } catch (error) {
            console.error("Error checking expired polls:", error);
        }
    }

    /**
     * Process a single expired poll
     */
    private async processExpiredPoll(poll: Poll): Promise<void> {
        if (!poll.groupId) {
            console.log(`Poll ${poll.id} has no groupId, skipping deadline message`);
            return;
        }

        try {
            // Create a simple deadline message similar to poll creation message
            const deadlineMessage = this.createSimpleDeadlineMessage(poll);
            
            // Log the exact message that's about to be sent
            console.log(`[${new Date().toISOString()}] 📤 About to send deadline message for poll "${poll.title}" (${poll.id}):`);
            console.log(`📝 Message content:`);
            console.log(`---`);
            console.log(deadlineMessage);
            console.log(`---`);
            
            // Send the system message
            await this.messageService.createSystemMessage({
                text: deadlineMessage,
                groupId: poll.groupId,
                voteId: poll.id
            });

            // Mark that we've sent the deadline message
            await this.pollRepository.update(poll.id, { deadlineMessageSent: true });
            
            console.log(`Successfully sent deadline message for poll: ${poll.title} (${poll.id})`);
            
        } catch (error) {
            console.error(`Failed to process expired poll ${poll.id}:`, error);
            throw error;
        }
    }

    /**
     * Create a simple deadline message similar to poll creation message
     */
    private createSimpleDeadlineMessage(poll: Poll): string {
        const voteUrl = `${process.env.PUBLIC_EVOTING_URL || 'http://localhost:3000'}/${poll.id}`;
        return `eVoting Platform: Vote results are in!\n\n"${poll.title}"\n\nVote ID: ${poll.id}\n\nCreated by: ${poll.creator.name}\n\n<a href="${voteUrl}" target="_blank">View results here</a>`;
    }

    /**
     * Get statistics about expired polls for monitoring
     */
    async getDeadlineStats(): Promise<{
        totalExpired: number;
        messagesSent: number;
        pendingMessages: number;
    }> {
        const now = new Date();
        
        // Use proper TypeORM syntax instead of MongoDB syntax
        const totalExpired = await this.pollRepository
            .createQueryBuilder("poll")
            .where("poll.deadline < :now", { now })
            .andWhere("poll.deadline IS NOT NULL")
            .getCount();

        const messagesSent = await this.pollRepository
            .createQueryBuilder("poll")
            .where("poll.deadline < :now", { now })
            .andWhere("poll.deadline IS NOT NULL")
            .andWhere("poll.deadlineMessageSent = :sent", { sent: true })
            .getCount();

        const pendingMessages = await this.pollRepository
            .createQueryBuilder("poll")
            .where("poll.deadline < :now", { now })
            .andWhere("poll.deadline IS NOT NULL")
            .andWhere("poll.deadlineMessageSent = :sent", { sent: false })
            .getCount();

        return {
            totalExpired,
            messagesSent,
            pendingMessages
        };
    }
} 