import { AppDataSource } from "../database/data-source";
import { Repository } from "typeorm";
import { VotingObservation } from "../database/entities/VotingObservation";

interface VotingContext {
    groupId: string;
    lastCheckTime: Date;
    lastVoteTime?: Date;
    requiredVoteInterval?: number;
    totalMessagesAnalyzed: number;
    lastFindings: string;
    timeSinceLastVote: number; // in seconds
    timeSinceLastCheck: number; // in seconds
}

export class VotingContextService {
    private observationRepository: Repository<VotingObservation>;

    constructor() {
        this.observationRepository = AppDataSource.getRepository(VotingObservation);
    }

    /**
     * Store a new voting observation for a group
     */
    async storeObservation(data: {
        groupId: string;
        lastVoteTime?: Date;
        requiredVoteInterval?: number;
        messagesAnalyzed: number;
        timeRangeStart: Date;
        timeRangeEnd: Date;
        findings: string;
    }): Promise<void> {
        const observation = this.observationRepository.create({
            groupId: data.groupId,
            lastCheckTime: new Date(),
            lastVoteTime: data.lastVoteTime,
            requiredVoteInterval: data.requiredVoteInterval,
            messagesAnalyzed: data.messagesAnalyzed,
            timeRangeStart: data.timeRangeStart,
            timeRangeEnd: data.timeRangeEnd,
            findings: data.findings,
        });

        // Store in database
        await this.observationRepository.save(observation);
    }

    /**
     * Get the voting context for a group
     */
    async getVotingContext(groupId: string): Promise<VotingContext | null> {
        const observations = await this.observationRepository.find({
            where: { groupId },
            order: { lastCheckTime: 'DESC' },
            take: 1
        });

        if (observations.length === 0) {
            return null;
        }

        const latest = observations[0];
        const now = new Date();
        
        return {
            groupId,
            lastCheckTime: latest.lastCheckTime,
            lastVoteTime: latest.lastVoteTime,
            requiredVoteInterval: latest.requiredVoteInterval,
            totalMessagesAnalyzed: latest.messagesAnalyzed,
            lastFindings: latest.findings,
            timeSinceLastVote: latest.lastVoteTime ? 
                Math.floor((now.getTime() - latest.lastVoteTime.getTime()) / 1000) : 
                // If no vote has ever been held, use a reasonable large number (1 year) to indicate violation
                31536000, // 1 year in seconds
            timeSinceLastCheck: Math.floor((now.getTime() - latest.lastCheckTime.getTime()) / 1000)
        };
    }

    /**
     * Check if a voting violation has occurred based on accumulated context
     */
    async checkVotingViolation(groupId: string, charterContent: string): Promise<{
        hasViolation: boolean;
        violationType?: string;
        timeSinceLastVote: number;
        requiredInterval?: number;
        message?: string;
    }> {
        console.log("🔍 VotingContextService.checkVotingViolation called for group:", groupId);
        console.log("🔍 Charter content:", charterContent);
        
        const context = await this.getVotingContext(groupId);
        console.log("🔍 Retrieved context:", context);
        
        if (!context) {
            console.log("🔍 No existing context found, returning no violation");
            return { hasViolation: false, timeSinceLastVote: 0 };
        }

        // Extract required voting interval from charter
        const requiredInterval = this.extractVotingInterval(charterContent);
        console.log("🔍 Extracted required interval:", requiredInterval);
        
        if (!requiredInterval) {
            console.log("🔍 No voting interval found in charter, returning no violation");
            return { hasViolation: false, timeSinceLastVote: context.timeSinceLastVote };
        }

        // Fix negative time values and ensure proper violation detection
        const timeSinceLastVote = Math.max(0, context.timeSinceLastVote);
        const hasViolation = timeSinceLastVote > requiredInterval;
        
        console.log(`🔍 Time calculation: timeSinceLastVote=${timeSinceLastVote}s, requiredInterval=${requiredInterval}s, hasViolation=${hasViolation}`);
        
        if (hasViolation) {
            const days = Math.floor(context.timeSinceLastVote / 86400);
            const hours = Math.floor((context.timeSinceLastVote % 86400) / 3600);
            const minutes = Math.floor((context.timeSinceLastVote % 3600) / 60);
            
            let timeString = "";
            if (days > 0) timeString += `${days} day${days > 1 ? 's' : ''} `;
            if (hours > 0) timeString += `${hours} hour${hours > 1 ? 's' : ''} `;
            if (minutes > 0) timeString += `${minutes} minute${minutes > 1 ? 's' : ''}`;
            
            return {
                hasViolation: true,
                violationType: 'voting_interval_exceeded',
                timeSinceLastVote: timeSinceLastVote,
                requiredInterval,
                message: `🚨 VOTING VIOLATION DETECTED! 🚨\n\nIt has been ${timeString}since the last required vote was held.\n\nAccording to your charter, votes must be held every ${this.formatInterval(requiredInterval)}.\n\nThis is a serious compliance issue that needs immediate attention!`
            };
        }

        return { hasViolation: false, timeSinceLastVote: timeSinceLastVote, requiredInterval };
    }

    /**
     * Extract voting interval requirements from charter text
     */
    private extractVotingInterval(charterContent: string): number | null {
        const text = charterContent.toLowerCase();
        
        console.log(`🔍 extractVotingInterval: Looking for patterns in: "${text}"`);
        
        // Look for common patterns
        const patterns = [
            /every\s+(\d+)\s+minute/i,
            /every\s+(\d+)\s+minutes/i,
            /every\s+(\d+)\s+hour/i,
            /every\s+(\d+)\s+hours/i,
            /every\s+(\d+)\s+day/i,
            /every\s+(\d+)\s+days/i,
            /every\s+(\d+)\s+week/i,
            /every\s+(\d+)\s+weeks/i,
            /every\s+(\d+)\s+month/i,
            /every\s+(\d+)\s+months/i,
            /(\d+)\s+minute/i,
            /(\d+)\s+minutes/i,
            /(\d+)\s+hour/i,
            /(\d+)\s+hours/i,
            /(\d+)\s+day/i,
            /(\d+)\s+days/i,
            /(\d+)\s+week/i,
            /(\d+)\s+weeks/i,
            /(\d+)\s+month/i,
            /(\d+)\s+months/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const value = parseInt(match[1]);
                if (pattern.source.includes('minute')) return value * 60;
                if (pattern.source.includes('hour')) return value * 3600;
                if (pattern.source.includes('day')) return value * 86400;
                if (pattern.source.includes('week')) return value * 604800;
                if (pattern.source.includes('month')) return value * 2592000;
            }
        }

        return null;
    }

    /**
     * Format interval in human-readable form
     */
    private formatInterval(seconds: number): string {
        if (seconds < 60) return `${seconds} second${seconds > 1 ? 's' : ''}`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) > 1 ? 's' : ''}`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) > 1 ? 's' : ''}`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) > 1 ? 's' : ''}`;
        if (seconds < 2592000) return `${Math.floor(seconds / 604800)} week${Math.floor(seconds / 604800) > 1 ? 's' : ''}`;
        return `${Math.floor(seconds / 2592000)} month${Math.floor(seconds / 2592000) > 1 ? 's' : ''}`;
    }


} 