import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Vote, VoteDataByMode, NormalVoteData, PointVoteData, RankVoteData } from "../database/entities/Vote";
import { Poll } from "../database/entities/Poll";
import { User } from "../database/entities/User";
import { VotingSystem, VoteData } from 'blindvote';

export class VoteService {
  private voteRepository: Repository<Vote>;
  private pollRepository: Repository<Poll>;
  private userRepository: Repository<User>;
  
  // Store VotingSystem instances per poll
  private votingSystems = new Map<string, VotingSystem>();

  constructor() {
    this.voteRepository = AppDataSource.getRepository(Vote);
    this.pollRepository = AppDataSource.getRepository(Poll);
    this.userRepository = AppDataSource.getRepository(User);
  }

  // ===== NON-BLIND VOTING METHODS (for normal/point/rank modes) =====

  async createVote(pollId: string, userId: string, voteData: VoteData, mode: "normal" | "point" | "rank" = "normal"): Promise<Vote> {
    const poll = await this.pollRepository.findOne({
      where: { id: pollId }
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    // Check if user has already voted
    const existingVote = await this.voteRepository.findOne({
      where: { pollId, userId }
    });

    if (existingVote) {
      throw new Error('User has already voted on this poll');
    }

    // Create vote with appropriate mode and proper typing
    let typedData: VoteDataByMode;
    if (mode === "normal") {
      // Frontend sends { optionId: 0 }, convert to ["0"]
      const optionId = (voteData as any).optionId;
      const optionArray = optionId !== undefined ? [optionId.toString()] : [];
      typedData = { mode: "normal", data: optionArray };
    } else if (mode === "point") {
      // Frontend sends { 0: 50, 1: 50 }, convert to [{ option: "0", points: 50 }, { option: "1", points: 50 }]
      const pointsData = voteData as any;
      const convertedData = Object.entries(pointsData).map(([index, points]) => ({
        option: index,
        points: points as number
      }));
      typedData = { mode: "point", data: convertedData };
    } else {
      // Frontend sends { 0: 1, 1: 2 }, convert to [{ option: "0", points: 1 }, { option: "1", points: 2 }]
      const ranksData = voteData as any;
      const convertedData = Object.entries(ranksData).map(([index, rank]) => ({
        option: index,
        points: rank as number
      }));
      typedData = { mode: "rank", data: convertedData };
    }

    const vote = this.voteRepository.create({
      pollId,
      userId,
      voterId: userId, // For non-blind voting, voterId is the same as userId
      data: typedData
    });

    return await this.voteRepository.save(vote);
  }

  async getVotesByPoll(pollId: string): Promise<Vote[]> {
    return await this.voteRepository.find({
      where: { pollId },
      relations: ['user']
    });
  }

  async getUserVote(pollId: string, userId: string): Promise<Vote | null> {
    return await this.voteRepository.findOne({
      where: { pollId, userId }
    });
  }

  async getPollResults(pollId: string): Promise<any> {
    const poll = await this.pollRepository.findOne({
      where: { id: pollId }
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    const votes = await this.getVotesByPoll(pollId);
    
    if (poll.mode === "normal") {
      // Count votes for each option
      const optionCounts: Record<string, number> = {};
      poll.options.forEach((option, index) => {
        optionCounts[option] = 0;
      });

      votes.forEach(vote => {
        if (vote.data.mode === "normal" && Array.isArray(vote.data.data)) {
          vote.data.data.forEach(optionIndex => {
            const option = poll.options[parseInt(optionIndex)];
            if (option) {
              optionCounts[option]++;
            }
          });
        }
      });

      const totalVotes = votes.length;
      const results = poll.options.map((option, index) => {
        const votes = optionCounts[option] || 0;
        const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
        return {
          option,
          votes,
          percentage
        };
      });

      return {
        pollId,
        totalVotes,
        results
      };
    }

    // For other modes, return basic info
    return {
      pollId,
      totalVotes: votes.length,
      mode: poll.mode
    };
  }

  // ===== BLIND VOTING METHODS =====

  private getVotingSystemForPoll(pollId: string): VotingSystem {
    if (!this.votingSystems.has(pollId)) {
      this.votingSystems.set(pollId, new VotingSystem());
    }
    return this.votingSystems.get(pollId)!;
  }

  async submitBlindVote(pollId: string, voterId: string, voteData: any) {
    try {
      const votingSystem = this.getVotingSystemForPoll(pollId);
      
      // Get poll to find options
      const poll = await this.pollRepository.findOne({
        where: { id: pollId }
      });

      if (!poll) {
        throw new Error('Poll not found');
      }

      // Create election if it doesn't exist
      try {
        const options = poll.options.map((opt: string, index: number) => `option_${index}`);
        votingSystem.createElection(pollId, pollId, options);
      } catch (error) {
        // Election might already exist, that's ok
      }

      // Register voter if not already registered
      try {
        votingSystem.registerVoter(voterId, pollId, pollId);
      } catch (error) {
        // Voter might already be registered, that's ok
      }

      // Extract per-option commitments and anchors from voteData
      const { commitments, anchors } = voteData;

      // Validate that we have commitments and anchors for all options
      const optionIds = poll.options.map((opt: string, index: number) => `option_${index}`);
      for (const optionId of optionIds) {
        if (!commitments[optionId] || !anchors[optionId]) {
          throw new Error(`Missing commitment or anchor for option ${optionId}`);
        }
      }

      // Convert hex strings back to Uint8Array for storage
      const processedCommitments: Record<string, Uint8Array> = {};
      const processedAnchors: Record<string, Uint8Array> = {};

      for (const optionId of optionIds) {
        processedCommitments[optionId] = new Uint8Array(
          commitments[optionId].match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []
        );
        processedAnchors[optionId] = new Uint8Array(
          anchors[optionId].match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []
        );
      }

      // Note: We don't call votingSystem.submitVote because we don't have chosenOptionId
      // This preserves privacy - the backend never knows which option was chosen

      // Store in database for persistence
      const blindVoteData: VoteDataByMode = {
        mode: "blind" as const,
        commitment: JSON.stringify({ commitments, anchors }), // NO chosenOptionId - that would break privacy!
        proof: "per_option_commitments",
        revealed: false
      };

      // For blind voting, look up the user by their ename (W3ID)
      const user = await this.userRepository.findOne({ where: { ename: voterId } });
      if (!user) {
        throw new Error(`User with ename ${voterId} not found. User must exist before submitting blind vote.`);
      }

      const vote = this.voteRepository.create({
        poll: { id: pollId },
        user: { id: user.id },
        voterId,
        data: blindVoteData
      });

      await this.voteRepository.save(vote);

      return { success: true, message: 'Blind vote submitted successfully' };

    } catch (error) {
      console.error('❌ Error in submitBlindVote:', error);
      throw error;
    }
  }

  async tallyBlindVotes(pollId: string) {
    try {
      const votingSystem = this.getVotingSystemForPoll(pollId);
      
      // Get poll details
      const poll = await this.pollRepository.findOne({
        where: { id: pollId }
      });

      if (!poll) {
        throw new Error('Poll not found');
      }

      // Get all votes for this poll
      const votes = await this.voteRepository.find({
        where: { poll: { id: pollId } },
        relations: ['user']
      });

      // Filter for blind votes
      const blindVotes = votes.filter(vote => 
        vote.data.mode === 'blind'
      );

      console.log(`🔍 Tallying ${blindVotes.length} blind votes for poll ${pollId}`);

      // Rebuild the VotingSystem state from database
      const options = poll.options.map((opt: string, index: number) => `option_${index}`);
      
      try {
        votingSystem.createElection(pollId, pollId, options);
      } catch (error) {
        // Election might already exist
      }

      // Re-register voters and re-submit votes
      for (const vote of blindVotes) {
        const blindVoteData = vote.data as any;
        console.log('🔍 Debug blindVoteData:', blindVoteData);
        console.log('🔍 Debug blindVoteData.commitment:', blindVoteData.commitment);
        console.log('🔍 Debug typeof commitment:', typeof blindVoteData.commitment);
        
        try {
          const voteData = JSON.parse(blindVoteData.commitment);
          const { commitments, anchors } = voteData; // NO chosenOptionId!
          const voterId = vote.voterId;

          try {
            votingSystem.registerVoter(voterId, pollId, pollId);
          } catch (error) {
            // Voter might already be registered, that's ok
          }

          // Convert hex strings back to Uint8Array
          const processedCommitments: Record<string, Uint8Array> = {};
          const processedAnchors: Record<string, Uint8Array> = {};

          for (const optionId of options) {
            processedCommitments[optionId] = new Uint8Array(
              commitments[optionId].match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []
            );
            processedAnchors[optionId] = new Uint8Array(
              anchors[optionId].match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []
            );
          }

          // Directly add the vote data to VotingSystem without revealing the chosen option
          // We use 'unknown' as chosenOptionId since we don't know and shouldn't know it
          const voteDataWithTimestamp: VoteData = {
            voterId,
            contestId: pollId,
            chosenOptionId: 'unknown', // We don't know the real choice - that's the point!
            commitments: processedCommitments,
            anchors: processedAnchors,
            submittedAt: new Date()
          };

          // Store the vote directly in the voting system (bypass submitVote to avoid chosenOptionId validation)
          votingSystem.addVoteForTallying(voterId, pollId, pollId, voteDataWithTimestamp);
        } catch (error) {
          console.error('❌ Error parsing blind vote data:', error);
          console.error('❌ Raw blindVoteData:', blindVoteData);
          throw error;
        }
      }

      // Now tally the election
      const electionResult = await votingSystem.tallyElection(pollId);

      console.log(`✅ Tallying completed for poll ${pollId}`);
      console.log(`📊 Results:`, electionResult.optionResults);

      // Convert the result to the expected format
      const optionResults = poll.options.map((option: string, index: number) => ({
        optionId: `option_${index}`,
        optionText: option,
        voteCount: electionResult.optionResults[`option_${index}`] || 0
      }));

      const totalVoteCount = Object.values(electionResult.optionResults).reduce((sum, count) => sum + count, 0);

      return {
        pollId,
        totalVotes: totalVoteCount,
        optionResults,
        verified: electionResult.verified,
        cryptographicProof: {
          C_agg: electionResult.C_agg,
          H_S: electionResult.H_S,
          X: electionResult.X
        }
      };

    } catch (error) {
      console.error('❌ Error in tallyBlindVotes:', error);
      throw error;
    }
  }

  async registerBlindVoteVoter(pollId: string, voterId: string) {
    try {
      const votingSystem = this.getVotingSystemForPoll(pollId);
      
      // Get poll details  
      const poll = await this.pollRepository.findOne({
        where: { id: pollId }
      });

      if (!poll) {
        throw new Error('Poll not found');
      }

      // Create election if it doesn't exist
      try {
        const options = poll.options.map((opt: string, index: number) => `option_${index}`);
        votingSystem.createElection(pollId, pollId, options);
      } catch (error) {
        // Election might already exist
      }

      // Register voter (or get existing registration)
      try {
        votingSystem.registerVoter(voterId, pollId, pollId);
      } catch (error: any) {
        // If voter is already registered, that's fine - they can still vote
        if (error.message.includes('already registered')) {
          console.log(`Voter ${voterId} already registered for poll ${pollId}, proceeding...`);
        } else {
          // Re-throw other errors
          throw error;
        }
      }

      return { 
        success: true, 
        message: 'Voter registered successfully'
      };

    } catch (error) {
      console.error('❌ Error in registerBlindVoteVoter:', error);
      throw error;
    }
  }

  // Generate vote data for a voter (used by eID wallet)
  async generateVoteData(pollId: string, voterId: string, chosenOptionId: string) {
    try {
      const votingSystem = this.getVotingSystemForPoll(pollId);
      
      // Get poll details
      const poll = await this.pollRepository.findOne({
        where: { id: pollId }
      });

      if (!poll) {
        throw new Error('Poll not found');
      }

      // Ensure voter is registered
      try {
        votingSystem.registerVoter(voterId, pollId, pollId);
      } catch (error) {
        // Voter might already be registered
      }

      // Generate vote data
      const voteData = votingSystem.generateVoteData(voterId, pollId, pollId, chosenOptionId);

      // Convert Uint8Array to hex strings for transmission
      const commitments: Record<string, string> = {};
      const anchors: Record<string, string> = {};

      for (const [optionId, commitment] of Object.entries(voteData.commitments)) {
        commitments[optionId] = Array.from(commitment).map(b => b.toString(16).padStart(2, '0')).join('');
      }

      for (const [optionId, anchor] of Object.entries(voteData.anchors)) {
        anchors[optionId] = Array.from(anchor).map(b => b.toString(16).padStart(2, '0')).join('');
      }

      return {
        pollId,
        voterId,
        chosenOptionId,
        commitments,
        anchors,
        options: poll.options.map((opt: string, index: number) => ({ 
          id: `option_${index}`, 
          text: opt 
        }))
      };

    } catch (error) {
      console.error('❌ Error in generateVoteData:', error);
      throw error;
    }
  }
}

export default new VoteService(); 