import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Vote, VoteDataByMode, NormalVoteData, PointVoteData, RankVoteData } from "../database/entities/Vote";
import { Poll } from "../database/entities/Poll";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { VotingSystem, VoteData } from 'blindvote';

export class VoteService {
  private voteRepository: Repository<Vote>;
  private pollRepository: Repository<Poll>;
  private userRepository: Repository<User>;
  private groupRepository: Repository<Group>;
  
  // Store VotingSystem instances per poll
  private votingSystems = new Map<string, VotingSystem>();

  constructor() {
    this.voteRepository = AppDataSource.getRepository(Vote);
    this.pollRepository = AppDataSource.getRepository(Poll);
    this.userRepository = AppDataSource.getRepository(User);
    this.groupRepository = AppDataSource.getRepository(Group);
  }

  /**
   * Check if a user can vote on a poll based on group membership
   */
  private async canUserVote(pollId: string, userId: string): Promise<boolean> {
    const poll = await this.pollRepository.findOne({
      where: { id: pollId },
      relations: ['creator']
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    // If poll has no group, it's a public poll - anyone can vote
    if (!poll.groupId) {
      return true;
    }

    // If poll has a group, check if user is a member, admin, or participant
    const group = await this.groupRepository
      .createQueryBuilder('group')
      .leftJoin('group.members', 'member')
      .leftJoin('group.admins', 'admin')
      .leftJoin('group.participants', 'participant')
      .where('group.id = :groupId', { groupId: poll.groupId })
      .andWhere('(member.id = :userId OR admin.id = :userId OR participant.id = :userId)', { userId })
      .getOne();

    if (!group) {
      throw new Error('User is not a member, admin, or participant of the group associated with this poll');
    }

    return true;
  }

  // ===== NON-BLIND VOTING METHODS (for normal/point/rank modes) =====

  async createVote(pollId: string, userId: string, voteData: VoteData, mode: "normal" | "point" | "rank" = "normal"): Promise<Vote> {
    // First check if user can vote on this poll
    await this.canUserVote(pollId, userId);

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
      // Frontend sends { points: { 0: 50, 1: 50 } }, store it directly
      const pointsData = voteData as any;
      if (pointsData.points && typeof pointsData.points === 'object') {
        // Store the points object directly: { "0": 50, "1": 50 }
        typedData = { mode: "point", data: pointsData.points };
      } else {
        // Fallback for direct object format
        typedData = { mode: "point", data: pointsData };
      }
    } else {
      // Frontend sends { 0: 1, 1: 2 }, convert to [{ option: "0", points: 1 }, { option: "1", points: 2 }]
      const ranksData = voteData as any;
      const convertedData = Object.entries(ranksData).map(([index, rank]) => ({
        option: index,
        points: rank as number
      }));
      typedData = { mode: "rank", data: convertedData };
    }

    // Get the user to get their ename for voterId
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const vote = this.voteRepository.create({
      pollId,
      userId,
      voterId: user.ename, // Use the user's ename as voterId for consistency with blind voting
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
    // First try to find by userId (for normal votes)
    let vote = await this.voteRepository.findOne({
      where: { pollId, userId }
    });

    // If no vote found by userId, check if this is a blind vote
    // For blind votes, we need to get the user's ename and check voterId
    if (!vote) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (user) {
        // Check for blind vote by voterId (ename)
        vote = await this.voteRepository.findOne({
          where: { pollId, voterId: user.ename }
        });
      }
    }

    return vote;
  }

  async getPollResults(pollId: string): Promise<any> {
    const poll = await this.pollRepository.findOne({
      where: { id: pollId }
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    const votes = await this.getVotesByPoll(pollId);
    
    // Get group member count for voting turnout calculation
    let totalEligibleVoters = 0;
    if (poll.groupId) {
      totalEligibleVoters = await this.getGroupMemberCount(poll.groupId);
    }
    
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
        totalEligibleVoters,
        turnout: totalEligibleVoters > 0 ? (totalVotes / totalEligibleVoters) * 100 : 0,
        results
      };
    } else if (poll.mode === "point") {
      // Calculate point-based voting results
      console.log('=== POINTS-BASED VOTING DEBUG ===');
      console.log('Poll ID:', pollId);
      console.log('Poll options:', poll.options);
      console.log('Total votes to process:', votes.length);
      
      const optionPoints: Record<string, number> = {};
      poll.options.forEach((option, index) => {
        optionPoints[option] = 0;
        console.log(`Initialized option ${index}: "${option}" with 0 points`);
      });

      votes.forEach((vote, voteIndex) => {
        console.log(`\n--- Processing Vote ${voteIndex + 1} ---`);
        console.log('Vote ID:', vote.id);
        console.log('Vote data:', JSON.stringify(vote.data, null, 2));
        console.log('Vote data type:', typeof vote.data);
        console.log('Vote data.mode:', (vote.data as any).mode);
        console.log('Vote data.data:', (vote.data as any).data);
        console.log('Vote data.data type:', typeof (vote.data as any).data);
        console.log('Is vote.data.data array?', Array.isArray((vote.data as any).data));
        
        if (vote.data.mode === "point") {
          console.log('✅ This is a point vote, processing...');
          
          // Handle the actual stored format: {"0": 10, "1": 10, "2": 50, "3": 20, "5": 10}
          if (typeof vote.data.data === 'object' && !Array.isArray(vote.data.data)) {
            console.log('✅ Processing direct object format vote data');
            console.log('Points object entries:', Object.entries(vote.data.data));
            
            Object.entries(vote.data.data).forEach(([optionIndex, points]) => {
              const index = parseInt(optionIndex);
              const option = poll.options[index];
              console.log(`Processing optionIndex: "${optionIndex}" -> parsed index: ${index}`);
              console.log(`Option at index ${index}:`, option);
              console.log(`Points value:`, points, `(type: ${typeof points})`);
              
              if (option && typeof points === 'number') {
                const oldPoints = optionPoints[option];
                optionPoints[option] += points;
                console.log(`✅ Option "${option}" gets ${points} points: ${oldPoints} + ${points} = ${optionPoints[option]}`);
              } else {
                console.log(`❌ Skipping invalid option "${optionIndex}" or points ${points}`);
                console.log(`  - option exists: ${!!option}`);
                console.log(`  - points is number: ${typeof points === 'number'}`);
              }
            });
          } else {
            console.log('❌ Unexpected data format for point vote');
            console.log('  - Expected: object and not array');
            console.log('  - Got: type =', typeof vote.data.data, ', isArray =', Array.isArray(vote.data.data));
          }
        } else {
          console.log('❌ This is NOT a point vote, skipping');
        }
      });

      const totalVotes = votes.length;
      console.log('\n=== FINAL CALCULATION ===');
      console.log('Total votes:', totalVotes);
      console.log('Final optionPoints object:', optionPoints);
      
      const results = poll.options.map((option, index) => {
        const points = optionPoints[option] || 0;
        const averagePoints = totalVotes > 0 ? points / totalVotes : 0;
        console.log(`Option "${option}": ${points} total points, ${averagePoints} average points`);
        return {
          option,
          totalPoints: points,
          averagePoints: Math.round(averagePoints * 100) / 100,
          votes: totalVotes
        };
      });

      // Sort by total points (highest first)
      results.sort((a, b) => b.totalPoints - a.totalPoints);
      console.log('\n=== FINAL RESULTS ===');
      console.log('Sorted results:', JSON.stringify(results, null, 2));

      return {
        pollId,
        totalVotes,
        totalEligibleVoters,
        turnout: totalEligibleVoters > 0 ? (totalVotes / totalEligibleVoters) * 100 : 0,
        mode: "point",
        results
      };
    } else if (poll.mode === "rank") {
      // Calculate rank-based voting results using Instant Runoff Voting (IRV)
      const irvResult = this.tallyIRV(votes, poll.options);
      
      return {
        pollId,
        totalVotes: votes.length,
        totalEligibleVoters,
        turnout: totalEligibleVoters > 0 ? (votes.length / totalEligibleVoters) * 100 : 0,
        mode: "rank",
        irvResult
      };
    }

    // Fallback for unknown modes
    return {
      pollId,
      totalVotes: votes.length,
      totalEligibleVoters,
      turnout: totalEligibleVoters > 0 ? (votes.length / totalEligibleVoters) * 100 : 0,
      mode: poll.mode,
      error: "Unsupported voting mode for results calculation"
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
      // First check if user can vote on this poll (group membership check)
      const user = await this.userRepository.findOne({ where: { ename: voterId } });
      if (!user) {
        throw new Error(`User with ename ${voterId} not found. User must exist before submitting blind vote.`);
      }

      // Check group membership using the existing method
      await this.canUserVote(pollId, user.id);

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

      // User is already fetched from the group membership check above
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

      // Get group member count for voting turnout calculation
      let totalEligibleVoters = 0;
      if (poll.groupId) {
        totalEligibleVoters = await this.getGroupMemberCount(poll.groupId);
      }

      return {
        pollId,
        totalVotes: totalVoteCount,
        totalEligibleVoters,
        turnout: totalEligibleVoters > 0 ? (totalVoteCount / totalEligibleVoters) * 100 : 0,
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
      // First check if user can vote on this poll (group membership check)
      const user = await this.userRepository.findOne({ where: { ename: voterId } });
      if (!user) {
        throw new Error(`User with ename ${voterId} not found. User must exist before registering for blind voting.`);
      }

      // Check group membership using the existing method
      await this.canUserVote(pollId, user.id);

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
      // First check if user can vote on this poll (group membership check)
      const user = await this.userRepository.findOne({ where: { ename: voterId } });
      if (!user) {
        throw new Error(`User with ename ${voterId} not found. User must exist before generating vote data.`);
      }

      // Check group membership using the existing method
      await this.canUserVote(pollId, user.id);

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

  // ===== IRV TALLYING METHODS =====

  /**
   * Tally Instant Runoff Voting (IRV) for ranked choice votes
   */
  private tallyIRV(votes: Vote[], options: string[]): any {
    // Parse and validate ballots
    const validBallots: Array<{ ballotId: string; ranking: number[] }> = [];
    const rejectedReasons: Array<{ ballotId: string; reason: string }> = [];
    
    for (const vote of votes) {
      try {
        if (vote.data.mode === "rank" && Array.isArray(vote.data.data)) {
          // Handle the stored format: [{ option: "ranks", points: { "0": 1, "1": 2, "2": 3 } }]
          const rankData = vote.data.data.find((item: any) => 
            item.option === "ranks" && item.points && typeof item.points === 'object'
          );
          
          if (rankData && rankData.points && typeof rankData.points === 'object') {
            const ranking = this.parseBallot(rankData.points as Record<string, number>);
            if (ranking) {
              validBallots.push({ ballotId: vote.id, ranking });
            }
          }
        }
      } catch (error) {
        rejectedReasons.push({ 
          ballotId: vote.id, 
          reason: error instanceof Error ? error.message : 'Invalid ballot format' 
        });
      }
    }

    const rejectedBallots = rejectedReasons.length;
    
    // Handle edge case: no valid ballots
    if (validBallots.length === 0) {
      return {
        winnerIndex: null,
        winnerOption: undefined,
        rounds: [],
        rejectedBallots,
        rejectedReasons
      };
    }

    // Determine number of candidates from valid ballots
    const maxCandidateIndex = Math.max(
      ...validBallots.flatMap(b => b.ranking)
    );
    const numCandidates = maxCandidateIndex + 1;

    // Handle edge case: only one candidate
    if (numCandidates === 1) {
      return {
        winnerIndex: 0,
        winnerOption: options[0],
        rounds: [{
          round: 1,
          active: [0],
          counts: { 0: validBallots.length },
          eliminated: null,
          exhausted: 0
        }],
        rejectedBallots,
        rejectedReasons
      };
    }

    // Initialize IRV process
    let activeCandidates = Array.from({ length: numCandidates }, (_, i) => i);
    let currentBallots: Array<{ ballotId: string; ranking: number[]; currentChoice: number | undefined }> = 
      validBallots.map(b => ({ ...b, currentChoice: b.ranking[0] }));
    const rounds: any[] = [];
    let round = 1;

    while (true) {
      // Count votes for current round
      const counts: Record<number, number> = {};
      let exhausted = 0;
      
      for (const ballot of currentBallots) {
        if (ballot.currentChoice !== undefined && activeCandidates.includes(ballot.currentChoice)) {
          counts[ballot.currentChoice] = (counts[ballot.currentChoice] || 0) + 1;
        } else {
          exhausted++;
        }
      }

      const activeVotes = validBallots.length - exhausted;
      const majorityThreshold = Math.floor(activeVotes / 2) + 1;

      // Check for winner
      let winner: number | null = null;
      for (const [candidate, count] of Object.entries(counts)) {
        if (count > majorityThreshold) {
          winner = parseInt(candidate);
          break;
        }
      }

      // Record this round
      rounds.push({
        round,
        active: [...activeCandidates],
        counts: { ...counts },
        eliminated: null,
        exhausted
      });

      // If we have a winner, stop
      if (winner !== null) {
        return {
          winnerIndex: winner,
          winnerOption: options[winner],
          rounds,
          rejectedBallots,
          rejectedReasons
        };
      }

      // If only one candidate remains, they win
      if (activeCandidates.length === 1) {
        return {
          winnerIndex: activeCandidates[0],
          winnerOption: options[activeCandidates[0]],
          rounds,
          rejectedBallots,
          rejectedReasons
        };
      }

      // If no active candidates have votes, no winner
      if (activeVotes === 0) {
        return {
          winnerIndex: null,
          winnerOption: undefined,
          rounds,
          rejectedBallots,
          rejectedReasons
        };
      }

      // Find candidate to eliminate
      const candidateToEliminate = this.findCandidateToEliminate(counts, activeCandidates, rounds);
      
      // Update active candidates
      activeCandidates = activeCandidates.filter(c => c !== candidateToEliminate);
      
      // Update ballots for next round
      currentBallots = currentBallots.map(ballot => {
        if (ballot.currentChoice === candidateToEliminate) {
          // Find next ranked active candidate
          const nextChoice = ballot.ranking.find(c => activeCandidates.includes(c));
          return { ...ballot, currentChoice: nextChoice };
        }
        return ballot;
      });

      // Mark elimination in the round
      rounds[rounds.length - 1].eliminated = candidateToEliminate;
      
      round++;
    }
  }

  /**
   * Parse ballot points into ranking array
   */
  private parseBallot(points: Record<string, number>): number[] {
    if (!points || typeof points !== 'object') {
      throw new Error('Invalid points object');
    }

    // Validate and collect rankings
    const rankings: Array<{ candidate: number; rank: number }> = [];
    const seenRanks = new Set<number>();

    for (const [candidateStr, rank] of Object.entries(points)) {
      const candidate = parseInt(candidateStr);
      const rankNum = parseInt(rank.toString());

      // Validation checks
      if (isNaN(candidate) || isNaN(rankNum)) {
        throw new Error('Non-integer candidate or rank values');
      }
      
      if (candidate < 0) {
        throw new Error('Negative candidate index');
      }
      
      if (rankNum < 1) {
        throw new Error('Rank must be at least 1');
      }
      
      if (seenRanks.has(rankNum)) {
        throw new Error('Duplicate rank values');
      }

      seenRanks.add(rankNum);
      rankings.push({ candidate, rank: rankNum });
    }

    // Sort by rank and return candidate indices
    return rankings
      .sort((a, b) => a.rank - b.rank)
      .map(r => r.candidate);
  }

  /**
   * Find candidate to eliminate using tie-breaking rules
   */
  private findCandidateToEliminate(
    counts: Record<number, number>, 
    activeCandidates: number[], 
    rounds: any[]
  ): number {
    // Find candidates with lowest vote count
    let minVotes = Infinity;
    let candidatesWithMinVotes: number[] = [];

    for (const candidate of activeCandidates) {
      const votes = counts[candidate] || 0;
      if (votes < minVotes) {
        minVotes = votes;
        candidatesWithMinVotes = [candidate];
      } else if (votes === minVotes) {
        candidatesWithMinVotes.push(candidate);
      }
    }

    // If only one candidate with minimum votes, eliminate them
    if (candidatesWithMinVotes.length === 1) {
      return candidatesWithMinVotes[0];
    }

    // Tie-breaker 1: Fewest first-choice appearances in round 1
    const round1Counts = rounds[0]?.counts || {};
    let minFirstChoice = Infinity;
    let candidatesWithMinFirstChoice: number[] = [];

    for (const candidate of candidatesWithMinVotes) {
      const firstChoiceVotes = round1Counts[candidate] || 0;
      if (firstChoiceVotes < minFirstChoice) {
        minFirstChoice = firstChoiceVotes;
        candidatesWithMinFirstChoice = [candidate];
      } else if (firstChoiceVotes === minFirstChoice) {
        candidatesWithMinFirstChoice.push(candidate);
      }
    }

    // If only one candidate with minimum first-choice votes, eliminate them
    if (candidatesWithMinFirstChoice.length === 1) {
      return candidatesWithMinFirstChoice[0];
    }

    // Tie-breaker 2: Lowest index
    return Math.min(...candidatesWithMinFirstChoice);
  }

  /**
   * Get the total number of members in a group for voting turnout calculation
   */
  private async getGroupMemberCount(groupId: string): Promise<number> {
    try {
      const group = await this.groupRepository
        .createQueryBuilder('group')
        .leftJoinAndSelect('group.members', 'member')
        .leftJoinAndSelect('group.admins', 'admin')
        .leftJoinAndSelect('group.participants', 'participant')
        .where('group.id = :groupId', { groupId })
        .getOne();

      if (!group) {
        return 0;
      }

      // Remove duplicates (someone might be both member and admin)
      const uniqueMemberIds = new Set<string>();
      
      if (group.members) {
        group.members.forEach(member => uniqueMemberIds.add(member.id));
      }
      if (group.admins) {
        group.admins.forEach(admin => uniqueMemberIds.add(admin.id));
      }
      if (group.participants) {
        group.participants.forEach(participant => uniqueMemberIds.add(participant.id));
      }

      return uniqueMemberIds.size;
    } catch (error) {
      console.error('Error getting group member count:', error);
      return 0;
    }
  }
}

export default new VoteService(); 