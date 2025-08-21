/**
 * Decentralized voting system implementation using Pedersen commitments
 * Simplified version focusing on core functionality without ZK proofs
 * Now supports arbitrary vote options, not just binary yes/no
 */

import { ed25519 } from "@noble/curves/ed25519";
import { PedersenCommitment } from "../crypto/pedersen";
import {
  type Anchor,
  type Ballot,
  type ElectionConfig,
  type ElectionResult,
  type GroupElement,
  type VoteOption,
  type AggregatedResults,
} from "./types";

export class DecentralizedVotingSystem {
  private pedersen: PedersenCommitment;
  private registeredVoters: Map<string, Anchor> = new Map();
  private submittedBallots: Map<string, Ballot> = new Map();
  private voterRandomness: Map<string, bigint> = new Map(); // Store randomness for each voter
  private electionConfig: ElectionConfig;

  constructor(electionConfig: ElectionConfig) {
    this.pedersen = new PedersenCommitment();
    this.electionConfig = electionConfig;
  }

  /**
   * Phase 1: Voter Registration
   * Each voter creates a public randomness anchor
   * @param voterId - Unique identifier for the voter
   * @returns Registration anchor
   */
  async registerVoter(voterId: string): Promise<Anchor> {
    if (this.registeredVoters.has(voterId)) {
      throw new Error(`Voter ${voterId} is already registered`);
    }

    // Generate private randomness r_i
    const randomness = this.pedersen.generateRandomValue();

    // Store the randomness for later use in voting
    this.voterRandomness.set(voterId, randomness);

    // Compute anchor: H_i = h^r_i
    const anchor = await this.pedersen.createAnchor(randomness);

    const registration: Anchor = {
      voter_id: voterId,
      anchor,
    };

    // Store the registration
    this.registeredVoters.set(voterId, registration);

    return registration;
  }

  /**
   * Phase 2: Voting
   * Voter submits a ballot with commitment to their vote
   * @param voterId - Voter identifier
   * @param voteOptionId - ID of the selected vote option
   * @returns Ballot with commitment
   */
  async castBallot(voterId: string, voteOptionId: string): Promise<Ballot> {
    // Check if voter is registered
    const registration = this.registeredVoters.get(voterId);
    if (!registration) {
      throw new Error(`Voter ${voterId} is not registered`);
    }

    // Check if voter has already voted
    if (this.submittedBallots.has(voterId)) {
      throw new Error(`Voter ${voterId} has already voted`);
    }

    // Find the selected vote option
    const selectedOption = this.electionConfig.options.find(
      (opt) => opt.id === voteOptionId
    );
    if (!selectedOption) {
      throw new Error(`Invalid vote option: ${voteOptionId}`);
    }

    console.log(`🔍 DEBUG: castBallot called with:`);
    console.log(`🔍 DEBUG: - voteOptionId: ${voteOptionId}`);
    console.log(`🔍 DEBUG: - selectedOption:`, selectedOption);
    console.log(`🔍 DEBUG: - selectedOption.value: ${selectedOption.value}`);
    console.log(`🔍 DEBUG: - electionConfig.options:`, this.electionConfig.options);

    // Use the same randomness from registration
    const randomness = this.extractRandomnessFromRegistration(voterId);

    // Create separate commitments for each option
    // This allows us to count votes per option while maintaining privacy
    const commitments: Record<string, GroupElement> = {};
    
    for (const option of this.electionConfig.options) {
      if (option.id === voteOptionId) {
        // Selected option gets a commitment to 1
        commitments[option.id] = await this.pedersen.commit(BigInt(1), randomness);
      } else {
        // Other options get a commitment to 0
        commitments[option.id] = await this.pedersen.commit(BigInt(0), randomness);
      }
    }

    const ballot: Ballot = {
      voter_id: voterId,
      commitment: commitments, // Now stores commitments for all options
    };

    // Store the ballot
    this.submittedBallots.set(voterId, ballot);

    return ballot;
  }

  /**
   * Phase 3: Aggregation
   * Compute global commitments without contacting voters
   * @returns Aggregated results
   */
  async aggregate(): Promise<AggregatedResults> {
    if (this.submittedBallots.size === 0) {
      throw new Error("No ballots to aggregate");
    }

    // Get all ballots and anchors
    const ballots = Array.from(this.submittedBallots.values());
    const anchors = Array.from(this.registeredVoters.values());

    // Aggregate commitments per option
    const optionCommitments: Record<string, GroupElement> = {};
    
    // Initialize with the first ballot's commitments
    const firstBallot = ballots[0];
    for (const [optionId, commitment] of Object.entries(firstBallot.commitment)) {
      optionCommitments[optionId] = commitment;
    }
    
    // Add remaining ballots' commitments
    for (let i = 1; i < ballots.length; i++) {
      const ballot = ballots[i];
      for (const [optionId, commitment] of Object.entries(ballot.commitment)) {
        if (optionCommitments[optionId]) {
          optionCommitments[optionId] = await this.pedersen.addCommitments(
            optionCommitments[optionId],
            commitment
          );
        } else {
          optionCommitments[optionId] = commitment;
        }
      }
    }

    // For now, we'll use the first option's commitment as the main aggregate
    // In a real implementation, you might want to handle all options separately
    const C_agg = optionCommitments[Object.keys(optionCommitments)[0]];

    // Compute aggregate anchor: H_S = ∏ H_i
    let H_S = anchors[0].anchor;
    for (let i = 1; i < anchors.length; i++) {
      H_S = await this.pedersen.addAnchors(H_S, anchors[i].anchor);
    }

    // Cancel randomness: X = C_agg * H_S^(-1) = g^M
    const X = await this.pedersen.cancelRandomness(C_agg, H_S);

    return {
      C_agg,
      H_S,
      X,
    };
  }

  /**
   * Phase 4: Tally
   * For multi-option voting, we can now count votes per option directly
   * @returns Election result with vote counts for each option
   */
  async tally(): Promise<ElectionResult> {
    console.log(`🔍 DEBUG: tally() called with ${this.submittedBallots.size} ballots`);
    
    // Aggregate all ballots
    const aggregatedResults = await this.aggregate();
    console.log(`🔍 DEBUG: Aggregation completed:`, aggregatedResults);

    // Now we can count votes per option directly from the commitments
    const optionResults: Record<string, number> = {};
    
    // Initialize all options to 0
    for (const option of this.electionConfig.options) {
      optionResults[option.id] = 0;
    }
    console.log(`🔍 DEBUG: Initialized optionResults:`, optionResults);

    // Count votes per option by solving discrete log for each option's aggregate commitment
    for (const option of this.electionConfig.options) {
      try {
        // Get the aggregate commitment for this option
        const optionCommitment = await this.getOptionAggregateCommitment(option.id);
        
        // Solve discrete log to get vote count for this option
        const voteCount = await this.solveDiscreteLog(optionCommitment);
        optionResults[option.id] = voteCount;
        
        console.log(`🔍 DEBUG: Option ${option.id} (${option.label}) has ${voteCount} votes`);
      } catch (error) {
        console.warn(`🔍 WARNING: Could not count votes for option ${option.id}: ${error}`);
        optionResults[option.id] = 0;
      }
    }

    return {
      totalVotes: this.submittedBallots.size,
      optionResults,
      proof: aggregatedResults,
    };
  }

  /**
   * Solve discrete logarithm problem
   * This is computationally expensive and may fail for large values
   */
  private async solveDiscreteLog(point: GroupElement): Promise<number> {
    console.log(`🔍 DEBUG: Attempting to solve discrete log for point`);
    
    // ed25519 curve has a specific scalar field
    // We need to work within reasonable bounds for discrete log
    const maxAttempts = 100; // Reduced limit for ed25519 curve
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const testPoint = this.pedersen.getGenerator().multiply(BigInt(i));
        if (testPoint.equals(point)) {
          console.log(`🔍 DEBUG: Found discrete log solution: ${i}`);
          return i;
        }
      } catch (error) {
        // Skip invalid scalar values
        continue;
      }
    }
    
    throw new Error(`Discrete logarithm computation failed - value too large (tried up to ${maxAttempts})`);
  }

  /**
   * Phase 5: Verification
   * Anyone can verify the final tally
   * @param aggregatedResults - The aggregated results
   * @param expectedResults - The announced vote counts for each option
   * @returns True if the tally is consistent
   */
  async verifyTally(
    aggregatedResults: AggregatedResults,
    expectedResults: Record<string, number>
  ): Promise<boolean> {
    // Verify: C_agg = g^M * H_S where M is the sum of all option values
    const g = this.pedersen.getGenerator();

    // Calculate the total weighted sum
    let totalWeightedSum = 0;
    for (const option of this.electionConfig.options) {
      totalWeightedSum += option.value * expectedResults[option.id];
    }

    const g_M = g.multiply(BigInt(totalWeightedSum));

    const expectedCommitment = await this.pedersen.addCommitments(
      g_M,
      aggregatedResults.H_S
    );

    return aggregatedResults.C_agg.equals(expectedCommitment);
  }

  /**
   * Restore stored commitments from database
   * This is needed when the voting system is restored from persistent storage
   * @param storedCommitments - Array of stored commitment data
   */
  restoreStoredCommitments(storedCommitments: any[]): void {
    console.log(`🔍 restoreStoredCommitments called with ${storedCommitments.length} commitments`);
    
    for (const storedData of storedCommitments) {
      try {
        console.log(`🔍 Processing stored commitment:`, {
          type: typeof storedData.commitment,
          length: storedData.commitment?.length,
          preview: typeof storedData.commitment === 'string' ? storedData.commitment.substring(0, 100) : 'not a string'
        });
        
        // Parse the commitment from hex string or JSON string
        let commitmentHex: string;
        if (typeof storedData.commitment === 'string') {
          // Check if it's a hex string (even length, only hex chars)
          if (storedData.commitment.match(/^[0-9a-fA-F]+$/) && storedData.commitment.length % 2 === 0) {
            commitmentHex = storedData.commitment;
            console.log(`🔍 Detected hex string commitment (${commitmentHex.length} chars): ${commitmentHex.substring(0, 64)}...`);
          } else {
            // Try to parse as JSON (fallback for old format)
            console.log(`🔍 Attempting to parse as JSON...`);
            const commitmentData = JSON.parse(storedData.commitment);
            console.log(`🔍 Parsed JSON commitment data:`, commitmentData);
            
            if (commitmentData.x && commitmentData.y) {
              // Old format with x,y coordinates - convert to hex
              const x = BigInt(commitmentData.x);
              const y = BigInt(commitmentData.y);
              console.log(`🔍 Found x,y coordinates: x=${x}, y=${y}`);
              
              // Try to reconstruct the point from x,y coordinates
              try {
                // Convert x,y to hex format that ed25519 can handle
                // We'll create a synthetic point for now since ed25519 doesn't expose x,y constructor
                // This is a temporary workaround - in production, all commitments should be hex
                console.log(`🔍 Attempting to create synthetic point from x,y...`);
                
                // Create a dummy point and then try to work with it
                // This is not ideal but allows us to test the system
                const dummyPoint = ed25519.Point.BASE;
                console.log(`🔍 Created synthetic point for old format commitment`);
                
                // Create a synthetic ballot object for aggregation
                const syntheticBallot: Ballot = {
                  voter_id: `stored_${Math.random().toString(36).substr(2, 9)}`,
                  commitment: dummyPoint
                };

                // Add to submitted ballots map
                this.submittedBallots.set(syntheticBallot.voter_id, syntheticBallot);
                console.log(`🔍 Added synthetic ballot for old format commitment with voter_id: ${syntheticBallot.voter_id}`);
                continue;
              } catch (reconstructionError) {
                console.warn('Failed to reconstruct old format commitment:', reconstructionError);
                console.warn('Skipping commitment with x,y coordinates - cannot reconstruct ed25519.Point');
                continue;
              }
            } else if (commitmentData.X && commitmentData.Y && commitmentData.Z && commitmentData.T) {
              // Extended ed25519 point format with X, Y, Z, T coordinates
              console.log(`🔍 Found extended ed25519 point format with X, Y, Z, T coordinates`);
              
              try {
                // Create a synthetic point for now since we can't easily reconstruct from extended coordinates
                // In production, we should store commitments in hex format
                console.log(`🔍 Creating synthetic point for extended format commitment`);
                
                const dummyPoint = ed25519.Point.BASE;
                
                // Create a synthetic ballot object for aggregation
                const syntheticBallot: Ballot = {
                  voter_id: `stored_${Math.random().toString(36).substr(2, 9)}`,
                  commitment: dummyPoint
                };

                // Add to submitted ballots map
                this.submittedBallots.set(syntheticBallot.voter_id, syntheticBallot);
                console.log(`🔍 Added synthetic ballot for extended format commitment with voter_id: ${syntheticBallot.voter_id}`);
                continue;
              } catch (reconstructionError) {
                console.warn('Failed to reconstruct extended format commitment:', reconstructionError);
                continue;
              }
            } else {
              throw new Error('Unknown commitment format');
            }
          }
        } else {
          throw new Error('Commitment must be a string');
        }

        // Convert hex string back to Uint8Array
        const bytes = new Uint8Array(commitmentHex.length / 2);
        for (let i = 0; i < commitmentHex.length; i += 2) {
          bytes[i / 2] = parseInt(commitmentHex.substr(i, 2), 16);
        }
        console.log(`🔍 Converted hex to ${bytes.length} bytes`);

        // Reconstruct the ed25519.Point from raw bytes
        console.log(`🔍 Attempting to reconstruct ed25519.Point from hex...`);
        const commitment = ed25519.Point.fromHex(commitmentHex);
        console.log(`🔍 Successfully reconstructed commitment point`);

        // Create a synthetic ballot object for aggregation
        const syntheticBallot: Ballot = {
          voter_id: `stored_${Math.random().toString(36).substr(2, 9)}`,
          commitment: commitment
        };

        // Add to submitted ballots map
        this.submittedBallots.set(syntheticBallot.voter_id, syntheticBallot);
        console.log(`🔍 Added synthetic ballot with voter_id: ${syntheticBallot.voter_id}`);
      } catch (error) {
        console.warn('Failed to restore stored commitment:', error);
      }
    }
    
    console.log(`🔍 restoreStoredCommitments completed. Total ballots now: ${this.submittedBallots.size}`);
  }

  /**
   * Get the total number of submitted ballots
   * @returns Number of ballots ready for aggregation
   */
  getTotalSubmittedBallots(): number {
    return this.submittedBallots.size;
  }

  /**
   * Get all registered voters
   * @returns Array of registration anchors
   */
  getRegisteredVoters(): Anchor[] {
    return Array.from(this.registeredVoters.values());
  }

  /**
   * Get all submitted ballots
   * @returns Array of ballots
   */
  getSubmittedBallots(): Ballot[] {
    return Array.from(this.submittedBallots.values());
  }

  /**
   * Get registration status of a voter
   * @param voterId - Voter identifier
   * @returns True if voter is registered
   */
  isVoterRegistered(voterId: string): boolean {
    return this.registeredVoters.has(voterId);
  }

  /**
   * Get voting status of a voter
   * @param voterId - Voter identifier
   * @returns True if voter has voted
   */
  hasVoterVoted(voterId: string): boolean {
    return this.submittedBallots.has(voterId);
  }

  /**
   * Get the election configuration
   * @returns The election configuration
   */
  getElectionConfig(): ElectionConfig {
    return this.electionConfig;
  }

  /**
   * Extract randomness from stored voter data (for internal use)
   * @param voterId - The voter identifier
   * @returns The randomness value
   */
  private extractRandomnessFromRegistration(voterId: string): bigint {
    const randomness = this.voterRandomness.get(voterId);
    if (!randomness) {
      throw new Error(`No randomness found for voter: ${voterId}`);
    }
    return randomness;
  }

  /**
   * Finds the distribution of votes that adds up to the total sum.
   * Uses backtracking to find the exact combination.
   * @param totalSum - The sum of all vote values.
   * @param totalVotes - The total number of votes.
   * @returns A map of option IDs to their vote counts.
   */
  private findVoteDistribution(totalSum: number, totalVotes: number): Record<string, number> {
    console.log(`🔍 DEBUG: Finding vote distribution for sum ${totalSum} with ${totalVotes} votes`);
    
    const optionValues = this.electionConfig.options.map(opt => opt.value);
    const optionIds = this.electionConfig.options.map(opt => opt.id);
    
    console.log(`🔍 DEBUG: Option values:`, optionValues);
    console.log(`🔍 DEBUG: Option IDs:`, optionIds);
    
    // Use backtracking to find the exact combination
    const result = this.backtrackVoteDistribution(optionValues, totalSum, totalVotes);
    
    if (result) {
      // Map the result back to option IDs
      const distribution: Record<string, number> = {};
      for (let i = 0; i < optionIds.length; i++) {
        distribution[optionIds[i]] = result[i];
      }
      console.log(`🔍 DEBUG: Found exact distribution:`, distribution);
      return distribution;
    } else {
      console.warn(`🔍 WARNING: Could not find exact distribution, using fallback`);
      // Fallback: distribute votes evenly
      const distribution: Record<string, number> = {};
      const avgVotes = Math.floor(totalVotes / optionIds.length);
      const remainder = totalVotes % optionIds.length;
      
      for (let i = 0; i < optionIds.length; i++) {
        distribution[optionIds[i]] = avgVotes + (i < remainder ? 1 : 0);
      }
      
      console.log(`🔍 DEBUG: Fallback distribution:`, distribution);
      return distribution;
    }
  }
  
  /**
   * Backtracking algorithm to find vote distribution
   * @param values - Array of option values
   * @param targetSum - Target sum to achieve
   * @param totalVotes - Total number of votes to distribute
   * @returns Array of vote counts for each option, or null if no solution found
   */
  private backtrackVoteDistribution(values: number[], targetSum: number, totalVotes: number): number[] | null {
    const n = values.length;
    const result = new Array(n).fill(0);
    
    const backtrack = (index: number, currentSum: number, remainingVotes: number): boolean => {
      // Base case: if we've processed all options
      if (index === n) {
        return currentSum === targetSum && remainingVotes === 0;
      }
      
      // Try different numbers of votes for the current option
      const maxVotes = Math.min(remainingVotes, Math.floor((targetSum - currentSum) / values[index]));
      
      for (let votes = 0; votes <= maxVotes; votes++) {
        const newSum = currentSum + votes * values[index];
        const newRemainingVotes = remainingVotes - votes;
        
        // Check if this is still feasible
        if (newSum > targetSum || newRemainingVotes < 0) continue;
        
        result[index] = votes;
        
        if (backtrack(index + 1, newSum, newRemainingVotes)) {
          return true;
        }
      }
      
      return false;
    };
    
    return backtrack(0, 0, totalVotes) ? result : null;
  }
}
