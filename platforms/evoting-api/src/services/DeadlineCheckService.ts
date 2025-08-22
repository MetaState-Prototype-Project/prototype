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
     * This method is designed to be called by a cron job every 10 minutes
     */
    async checkExpiredPolls(): Promise<void> {
        const now = new Date();
        
        try {
            // Find all polls with deadlines that have passed and haven't had deadline messages sent yet
            const expiredPolls = await this.pollRepository
                .createQueryBuilder("poll")
                .leftJoinAndSelect("poll.creator", "creator")
                .where("poll.deadline < :now", { now })
                .andWhere("poll.deadlineMessageSent = :sent", { sent: false })
                .andWhere("poll.deadline IS NOT NULL")
                .getMany();

            console.log(`Found ${expiredPolls.length} expired polls that need deadline messages`);

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
            // Get the final results for this poll using blind voting tally
            let results;
            try {
                results = await this.voteService.tallyBlindVotes(poll.id);
            } catch (error) {
                console.log(`Poll ${poll.id} has no blind votes, using basic poll info`);
                // If no blind votes, create basic results from poll options
                results = {
                    totalVotes: 0,
                    optionResults: poll.options.map((option: string, index: number) => ({
                        optionId: `option_${index}`,
                        optionText: option,
                        voteCount: 0
                    }))
                };
            }
            
            // Create a comprehensive deadline message with results
            const deadlineMessage = this.createDeadlineMessageWithResults(poll, results);
            
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
     * Create a comprehensive deadline message with voting results
     */
    private createDeadlineMessageWithResults(poll: Poll, results: any): string {
        let resultsText = '';
        
        if (results && results.optionResults) {
            resultsText = '\n\n📊 **Final Results:**\n';
            results.optionResults.forEach((result: any, index: number) => {
                const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '•';
                resultsText += `${emoji} ${result.optionText}: ${result.voteCount} votes\n`;
            });
        } else if (results && results.results) {
            // Fallback for old format
            resultsText = '\n\n📊 **Final Results:**\n';
            results.results.forEach((result: any, index: number) => {
                const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '•';
                resultsText += `${emoji} ${result.option}: ${result.votes} votes (${result.percentage.toFixed(1)}%)\n`;
            });
        }

        return `🗳️ **Vote Results Are In!**\n\n"${poll.title}"\n\nVote ID: ${poll.id}\n\nCreated by: ${poll.creator.name}${resultsText}\n\nThis vote has ended. The results are final!`;
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
        
        const totalExpired = await this.pollRepository.count({
            where: {
                deadline: { $lt: now } as any
            }
        });

        const messagesSent = await this.pollRepository.count({
            where: {
                deadline: { $lt: now } as any,
                deadlineMessageSent: true
            }
        });

        const pendingMessages = await this.pollRepository.count({
            where: {
                deadline: { $lt: now } as any,
                deadlineMessageSent: false
            }
        });

        return {
            totalExpired,
            messagesSent,
            pendingMessages
        };
    }
} 