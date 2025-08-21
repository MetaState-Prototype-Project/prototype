import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Vote, VoteDataByMode } from "../database/entities/Vote";
import { Poll } from "../database/entities/Poll";
import { User } from "../database/entities/User";
import { PollVotingState } from "../database/entities/PollVotingState";
import { DecentralizedVotingSystem, ElectionConfig, VoteOption } from "blindvote";

export class VoteService {
    private voteRepository: Repository<Vote>;
    private pollRepository: Repository<Poll>;
    private userRepository: Repository<User>;
    private pollVotingStateRepository: Repository<PollVotingState>;

    constructor() {
        this.voteRepository = AppDataSource.getRepository(Vote);
        this.pollRepository = AppDataSource.getRepository(Poll);
        this.userRepository = AppDataSource.getRepository(User);
        this.pollVotingStateRepository = AppDataSource.getRepository(PollVotingState);
    }

    /**
     * Create an ElectionConfig from a Poll
     */
    private createElectionConfig(poll: Poll): ElectionConfig {
        const options: VoteOption[] = poll.options.map((option, index) => ({
            id: `option_${index}`,
            label: option,
            value: index // Use index as value for simplicity
        }));

        return {
            id: poll.id,
            title: poll.title,
            description: "", // Poll doesn't have description field
            options,
            maxVotes: 1, // One vote per voter
            allowAbstain: false
        };
    }

    /**
     * Submit a blind vote using the new blindvote library
     */
    async submitBlindVote(pollId: string, userId: string, commitment: any, proof: any, optionIndex?: number): Promise<Vote> {
        console.log(`🔍 Submitting blind vote for poll ${pollId} by user ${userId}`);
        
        const poll = await this.pollRepository.findOne({
            where: { id: pollId }
        });

        if (!poll) {
            throw new Error("Poll not found");
        }

        if (poll.visibility !== "private") {
            throw new Error("Blind voting only allowed for private polls");
        }
        
        // Check if user has already voted
        const existingVote = await this.voteRepository.findOne({
            where: { poll: { id: pollId }, user: { id: userId } }
        });

        if (existingVote) {
            throw new Error('User has already voted in this poll');
        }

        // Convert commitment to string if it's an object
        let commitmentString = commitment;
        if (typeof commitment === 'object' && commitment !== null) {
            // Store the commitment as raw bytes instead of JSON string
            // This allows us to properly reconstruct the ed25519.Point later
            if (commitment.toRawBytes) {
                // Convert to hex string for storage
                const rawBytes = commitment.toRawBytes();
                commitmentString = Array.from(rawBytes as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
                console.log(`🔍 Storing commitment as hex string (${commitmentString.length} chars): ${commitmentString.substring(0, 64)}...`);
            } else {
                // Fallback to JSON if no toRawBytes method
                commitmentString = JSON.stringify(commitment);
                console.log(`🔍 Storing commitment as JSON (fallback): ${commitmentString.substring(0, 100)}...`);
            }
            console.log(`🔍 Converted commitment object to hex string: ${commitmentString}`);
        }

        const blindVoteData = {
            mode: "blind" as const,
            commitment: commitmentString,
            proof: proof,
            // Remove optionIndex - blind voting should not reveal the selected option
            submittedAt: new Date()
        };

        const vote = this.voteRepository.create({
            poll: { id: pollId },
            user: { id: userId },
            voterId: userId,
            data: blindVoteData
        });

        const savedVote = await this.voteRepository.save(vote);
        console.log(`✅ Blind vote saved with ID: ${savedVote.id}`);

        // Update PollVotingState with the commitment data
        try {
            console.log(`🔍 Attempting to update PollVotingState for poll ${pollId}`);
            
            let votingState = await this.pollVotingStateRepository.findOne({
                where: { pollId }
            });
            
            if (!votingState) {
                // Create new voting state for this poll
                votingState = this.pollVotingStateRepository.create({
                    pollId,
                    registeredVoters: [],
                    voterAnchors: [],
                    commitments: [],
                    proofs: []
                });
                console.log(`🔍 Created new PollVotingState for poll ${pollId}`);
            } else {
                // Ensure arrays are initialized for existing voting state
                if (!votingState.commitments) {
                    votingState.commitments = [];
                }
                if (!votingState.voterAnchors) {
                    votingState.voterAnchors = [];
                }
                if (!votingState.proofs) {
                    votingState.proofs = [];
                }
                if (!votingState.registeredVoters) {
                    votingState.registeredVoters = [];
                }
            }

            const commitmentData = {
                commitment: commitmentString,
                proof: proof
                // Removed optionIndex and userId to maintain privacy
            };

            console.log(`🔍 About to add commitment data:`, commitmentData);
            console.log(`🔍 Commitments array before push:`, votingState.commitments);
            votingState.commitments.push(commitmentData);
            console.log(`🔍 Commitments array after push:`, votingState.commitments);

            await this.pollVotingStateRepository.save(votingState);
            console.log(`✅ Successfully updated PollVotingState for poll ${pollId} with commitment from user ${userId}`);
        } catch (error) {
            console.error(`❌ Error updating PollVotingState:`, error);
            // Don't fail the vote submission if this fails
        }

        return savedVote;
    }

    /**
     * Tally blind votes using the new blindvote library
     */
    async tallyBlindVotes(pollId: string): Promise<{ 
        totalVotes: number; 
        committedVotes: number; 
        results: Array<{ option: string; votes: number }>;
        optionResults: number[]; 
        aggregatedCommitment: string; 
        cryptographicProof: any 
    }> {
        console.log(`🔍 Tallying blind votes for poll ${pollId}`);
        
        const poll = await this.pollRepository.findOne({
            where: { id: pollId }
        });

        if (!poll) {
            throw new Error("Poll not found");
        }

        if (poll.visibility !== "private") {
            throw new Error("Blind voting only allowed for private polls");
        }

        // Count committed votes
        const committedVotes = await this.voteRepository.count({
            where: { poll: { id: pollId } }
        });

        console.log(`🔍 Found ${committedVotes} committed votes for poll ${pollId}`);

        if (committedVotes === 0) {
            return {
                totalVotes: 0,
                committedVotes: 0,
                results: [],
                optionResults: new Array(poll.options.length).fill(0),
                aggregatedCommitment: "no_votes",
                cryptographicProof: null
            };
        }

        // Load the voting state
        let votingState = await this.pollVotingStateRepository.findOne({
            where: { pollId }
        });

        if (!votingState) {
            console.log(`⚠️ No PollVotingState found for poll ${pollId}, creating new one`);
            votingState = this.pollVotingStateRepository.create({
                pollId,
                registeredVoters: [],
                voterAnchors: [],
                commitments: [],
                proofs: []
            });
            await this.pollVotingStateRepository.save(votingState);
        }

        // Ensure arrays are initialized
        if (!votingState.commitments) votingState.commitments = [];
        if (!votingState.voterAnchors) votingState.voterAnchors = [];
        if (!votingState.proofs) votingState.proofs = [];
        if (!votingState.registeredVoters) votingState.registeredVoters = [];

        console.log(`🔍 Using PollVotingState ${votingState.id} with ${votingState.commitments.length} commitments`);

        try {
            // Create election config from the poll
            const electionConfig = this.createElectionConfig(poll);
            const votingSystem = new DecentralizedVotingSystem(electionConfig);
            
            // Restore the voting system state from our database
            await this.restorePollVotingState(votingSystem, pollId);

            // Now use the proper tally method to get the actual vote counts
            const electionResult = await votingSystem.tally();
            console.log(`🔍 Election result:`, electionResult);

            // Convert the option results to an array
            const optionResults = poll.options.map((_, index) => {
                const optionId = `option_${index}`;
                return electionResult.optionResults[optionId] || 0;
            });

            console.log(`🔍 Cryptographic tallying complete: ${optionResults.join(', ')} votes across ${poll.options.length} options`);

            return {
                totalVotes: committedVotes,
                committedVotes,
                results: poll.options.map((option, index) => ({
                    option,
                    votes: optionResults[index] || 0
                })),
                optionResults,
                aggregatedCommitment: electionResult.proof.C_agg.toString(),
                cryptographicProof: {
                    method: "pedersen_commitment_aggregation",
                    aggregatedCommitment: electionResult.proof.C_agg.toString(),
                    totalCommitments: votingState.commitments.length,
                    electionResult: {
                        totalVotes: electionResult.totalVotes,
                        optionResults: electionResult.optionResults
                    }
                }
            };
        } catch (error) {
            console.error(`❌ Error during cryptographic tallying:`, error);
            
            // Fallback: return basic counts based on stored commitments
            const optionResults = new Array(poll.options.length).fill(0);
            
            console.log(`🔍 Fallback tallying: ${optionResults.join(', ')} votes across ${poll.options.length} options`);
            
            return {
                totalVotes: committedVotes,
                committedVotes,
                results: poll.options.map((option, index) => ({
                    option,
                    votes: optionResults[index] || 0
                })),
                optionResults,
                aggregatedCommitment: "tallying_failed_fallback",
                cryptographicProof: {
                    method: "fallback_counting",
                    note: "Cryptographic tallying failed, using fallback"
                }
            };
        }
    }

    /**
     * Register a voter for blind voting in the backend's voting system
     * @param pollId - The poll ID
     * @param voterId - The voter's W3ID (without @ prefix)
     * @returns The registration anchor
     */
    async registerBlindVoteVoter(pollId: string, voterId: string): Promise<any> {
        try {
            // Get the poll first
            const poll = await this.pollRepository.findOne({
                where: { id: pollId }
            });

            if (!poll) {
                throw new Error("Poll not found");
            }

            // Check if voter is already registered for this poll
            let votingState = await this.pollVotingStateRepository.findOne({
                where: { pollId }
            });

            if (!votingState) {
                // Create new voting state for this poll
                votingState = this.pollVotingStateRepository.create({
                    pollId,
                    registeredVoters: [],
                    voterAnchors: [],
                    commitments: [],
                    proofs: []
                });
            }

            // If voter is already registered but hasn't voted, allow re-registration
            // (This handles cases where the app was restarted and state was lost)
            if (votingState.registeredVoters.includes(voterId)) {
                console.log(`Voter ${voterId} already registered for poll ${pollId}, checking if they can vote`);
                
                // Check if they've already submitted a vote
                const existingVote = await this.voteRepository.findOne({
                    where: {
                        poll: { id: pollId },
                        user: { id: voterId }
                    }
                });
                
                if (existingVote) {
                    throw new Error(`Voter ${voterId} has already submitted a vote for poll ${pollId}`);
                }
                
                console.log(`Voter ${voterId} is registered but hasn't voted yet, allowing them to proceed`);
                // Don't remove the old registration - just let them use it
            }

            // Create election config and voting system
            const electionConfig = this.createElectionConfig(poll);
            const votingSystem = new DecentralizedVotingSystem(electionConfig);
            
            // Create a NEW instance for this specific poll
            // const votingSystem = new DecentralizedVotingSystem(); // This line is removed as it's now global
            
            // Restore poll state from database
            await this.restorePollVotingState(votingSystem, pollId);
            
            // Check if voter is already registered in the voting system
            if (!votingSystem.isVoterRegistered(voterId)) {
                // Register the voter only if they're not already registered
                const registration = await votingSystem.registerVoter(voterId);
                
                // Add voter to the registered voters list
                votingState.registeredVoters.push(voterId);
                if (!votingState.voterAnchors) votingState.voterAnchors = [];
                
                // Convert BigInt values to strings for database storage
                const serializedRegistration = this.serializeForDatabase(registration);
                votingState.voterAnchors.push(serializedRegistration);
                
                // Save the updated state back to database
                await this.pollVotingStateRepository.save(votingState);
                
                return registration;
            } else {
                console.log(`Voter ${voterId} is already registered in voting system, returning existing registration`);
                // Return a mock registration object since they're already registered
                return {
                    voter_id: voterId,
                    anchor: null, // We don't need to return the actual anchor
                    randomness: null
                };
            }
        } catch (error) {
            console.error("Error registering blind vote voter:", error);
            throw error;
        }
    }

    /**
     * Restore the voting system state from the database
     */
    private async restorePollVotingState(votingSystem: DecentralizedVotingSystem, pollId: string): Promise<void> {
        console.log(`🔍 Restoring voting state for poll ${pollId}`);
        
        const votingState = await this.pollVotingStateRepository.findOne({
            where: { pollId }
        });

        if (!votingState) {
            console.log(`🔍 No existing voting state found for poll ${pollId}, creating new one`);
            return;
        }

        // Restore registered voters
        if (votingState.registeredVoters && votingState.registeredVoters.length > 0) {
            console.log(`🔍 Restoring ${votingState.registeredVoters.length} registered voters`);
            for (const voterId of votingState.registeredVoters) {
                try {
                    // Check if voter is already registered before trying to register them
                    if (!votingSystem.isVoterRegistered(voterId)) {
                        await votingSystem.registerVoter(voterId);
                        console.log(`Restored voter ${voterId} for poll ${pollId}`);
                    } else {
                        console.log(`Voter ${voterId} already registered in voting system, skipping registration`);
                    }
                } catch (error) {
                    console.warn(`Failed to restore voter ${voterId}:`, error);
                }
            }
        }

        // Restore stored commitments using the new method
        if (votingState.commitments && votingState.commitments.length > 0) {
            console.log(`🔍 Adding ${votingState.commitments.length} stored commitments to voting system`);
            votingSystem.restoreStoredCommitments(votingState.commitments);
        }
    }

    /**
     * Save voting system state to database for a specific poll
     */
    private async savePollVotingState(votingSystem: any, pollId: string): Promise<void> {
        try {
            // Get the existing voting state
            const votingState = await this.pollVotingStateRepository.findOne({
                where: { pollId }
            });

            if (!votingState) {
                console.log(`⚠️ No voting state found for poll ${pollId} during save`);
                return; // Don't create new state here - let submitBlindVote handle it
            }

            // Extract current state from the voting system
            // Note: This is a simplified approach - in a real implementation,
            // you'd need to expose methods to get the internal state
            const registeredVoters = votingState.registeredVoters || [];
            
            // Update the voting state
            votingState.registeredVoters = registeredVoters;
            
            await this.pollVotingStateRepository.save(votingState);
            console.log(`Saved voting system state for poll ${pollId}`);
            
        } catch (error) {
            console.error("Error saving poll voting state:", error);
        }
    }

    /**
     * Check if a user has already submitted a vote for a specific poll
     * @param pollId - The poll ID
     * @param userId - The user ID
     * @returns True if user has already voted, false otherwise
     */
    async hasUserVoted(pollId: string, userId: string): Promise<boolean> {
        const existingVote = await this.voteRepository.findOne({
            where: {
                poll: { id: pollId },
                user: { id: userId }
            }
        });
        
        return !!existingVote;
    }

    /**
     * Get user by ID (for w3id validation)
     * @param userId - The user ID
     * @returns The user or null if not found
     */
    async getUserById(userId: string): Promise<any> {
        return await this.userRepository.findOne({
            where: { id: userId }
        });
    }

    /**
     * Get poll for blind voting
     */
    async getPollForBlindVoting(pollId: string): Promise<any> {
        const poll = await this.pollRepository.findOne({
            where: { id: pollId },
            relations: ['creator'] // Only load the creator relation which exists
        });

        if (!poll) {
            throw new Error("Poll not found");
        }

        console.log(`🔍 DEBUG: getPollForBlindVoting returning poll:`);
        console.log(`🔍 DEBUG: - poll.options array:`, poll.options);
        console.log(`🔍 DEBUG: - poll.options.length:`, poll.options.length);
        console.log(`🔍 DEBUG: - poll.options with indices:`, poll.options.map((opt, idx) => `${idx}: "${opt}"`));

        return poll;
    }

    // Add missing methods that VoteController expects

    /**
     * Create a regular vote (non-blind)
     */
    async createVote(data: { pollId: string; userId: string; optionId?: string; points?: number; ranks?: number[] }): Promise<Vote> {
        const { pollId, userId, optionId, points, ranks } = data;

        // Check if user has already voted
        const existingVote = await this.voteRepository.findOne({
            where: { poll: { id: pollId }, user: { id: userId } }
        });

        if (existingVote) {
            throw new Error('User has already voted on this poll');
        }

        // Check if poll exists
        const poll = await this.pollRepository.findOne({
            where: { id: pollId }
        });

        if (!poll) {
            throw new Error('Poll not found');
        }

        // Check if user exists
        const user = await this.userRepository.findOne({
            where: { id: userId }
        });

        if (!user) {
            throw new Error('User not found');
        }

        let voteData: VoteDataByMode;

        if (poll.mode === "rank" && ranks) {
            // For rank mode, create array of { option, points } where points = rank (1 = top pick, 2 = next, etc.)
            const rankedOptions = ranks.map((rankIndex, rankPosition) => ({
                option: poll.options[rankIndex],
                points: rankPosition + 1 // 1 = top pick, 2 = next, etc.
            })).filter(item => item.option);
            voteData = { mode: "rank", data: rankedOptions };
        } else if (poll.mode === "point" && points !== undefined) {
            // For point mode, create array with option and points
            const optionIndex = parseInt(optionId || "0");
            if (optionIndex >= 0 && optionIndex < poll.options.length) {
                voteData = { 
                    mode: "point", 
                    data: [{ option: poll.options[optionIndex], points }] 
                };
            } else {
                throw new Error('Invalid option selected');
            }
        } else if (optionId !== undefined) {
            // For normal mode, create array with selected option
            const optionIndex = parseInt(optionId);
            if (optionIndex >= 0 && optionIndex < poll.options.length) {
                voteData = { mode: "normal", data: [poll.options[optionIndex]] };
            } else {
                throw new Error('Invalid option selected');
            }
        } else {
            throw new Error('Invalid vote data for poll mode');
        }

        const vote = this.voteRepository.create({
            poll: { id: pollId },
            user: { id: userId },
            voterId: userId,
            data: voteData
        });

        return await this.voteRepository.save(vote);
    }

    /**
     * Get all votes for a specific poll
     */
    async getVotesByPoll(pollId: string): Promise<Vote[]> {
        return await this.voteRepository.find({
            where: { poll: { id: pollId } },
            relations: ['user', 'poll']
        });
    }

    /**
     * Get a specific user's vote for a poll
     */
    async getUserVote(pollId: string, userId: string): Promise<Vote | null> {
        return await this.voteRepository.findOne({
            where: { poll: { id: pollId }, user: { id: userId } },
            relations: ['user', 'poll']
        });
    }

    /**
     * Get poll results (aggregated)
     */
    async getPollResults(pollId: string): Promise<any> {
        const poll = await this.pollRepository.findOne({
            where: { id: pollId }
        });

        if (!poll) {
            throw new Error('Poll not found');
        }

        const votes = await this.voteRepository.find({
            where: { poll: { id: pollId } },
            relations: ['user']
        });

        if (poll.visibility === "private") {
            // For private polls, return blind vote results
            return await this.tallyBlindVotes(pollId);
        }

        // For public polls, return regular results
        const results: any = {
            totalVotes: votes.length,
            results: [],
            optionResults: []
        };

        if (poll.mode === "normal") {
            // Count votes per option
            const optionCounts = new Map<string, number>();
            poll.options.forEach(option => optionCounts.set(option, 0));

            votes.forEach(vote => {
                if (vote.data.mode === "normal") {
                    // For normal mode, data is an array of selected options
                    vote.data.data.forEach(selectedOption => {
                        if (poll.options.includes(selectedOption)) {
                            optionCounts.set(selectedOption, (optionCounts.get(selectedOption) || 0) + 1);
                        }
                    });
                }
            });

            results.optionResults = Array.from(optionCounts.entries()).map(([option, count]) => ({
                option,
                count
            }));
        } else if (poll.mode === "rank") {
            // Calculate ranked voting results
            results.optionResults = poll.options.map(option => ({
                option,
                averageRank: 0,
                totalVotes: 0
            }));

            votes.forEach(vote => {
                if (vote.data.mode === "rank") {
                    // For rank mode, data is an array of { option, points } where points = rank
                    vote.data.data.forEach(({ option, points }) => {
                        const optionIndex = poll.options.indexOf(option);
                        if (optionIndex >= 0 && optionIndex < results.optionResults.length) {
                            results.optionResults[optionIndex].totalVotes++;
                            results.optionResults[optionIndex].averageRank += points; // points = rank (1 = best)
                        }
                    });
                }
            });

            results.optionResults.forEach((result: any) => {
                if (result.totalVotes > 0) {
                    result.averageRank = result.averageRank / result.totalVotes;
                }
            });
        } else if (poll.mode === "point") {
            // Calculate points-based results
            results.optionResults = poll.options.map(option => ({
                option,
                totalPoints: 0,
                averagePoints: 0,
                totalVotes: 0
            }));

            votes.forEach(vote => {
                if (vote.data.mode === "point") {
                    // For point mode, data is an array of { option, points }
                    vote.data.data.forEach(({ option, points }) => {
                        const optionIndex = poll.options.indexOf(option);
                        if (optionIndex >= 0 && optionIndex < results.optionResults.length) {
                            results.optionResults[optionIndex].totalPoints += points;
                            results.optionResults[optionIndex].totalVotes++;
                        }
                    });
                }
            });

            results.optionResults.forEach((result: any) => {
                if (result.totalVotes > 0) {
                    result.averagePoints = result.totalPoints / result.totalVotes;
                }
            });
        }

        return results;
    }

    /**
     * Serialize objects containing BigInt values to strings for database storage.
     * This is necessary because TypeORM cannot serialize BigInt values to JSON.
     */
    private serializeForDatabase(obj: any): any {
        if (obj === null || obj === undefined) {
            return obj;
        }
        
        if (typeof obj === 'bigint') {
            return obj.toString();
        }
        
        if (typeof obj === 'object') {
            if (Array.isArray(obj)) {
                return obj.map(item => this.serializeForDatabase(item));
            } else {
                const serialized: any = {};
                for (const [key, value] of Object.entries(obj)) {
                    serialized[key] = this.serializeForDatabase(value);
                }
                return serialized;
            }
        }
        
        return obj;
    }
} 