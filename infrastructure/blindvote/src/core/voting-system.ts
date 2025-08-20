/**
 * Decentralized voting system implementation using Pedersen commitments and ZK proofs
 * Implements the protocol described in the specification
 */

import {
  Anchor,
  Ballot,
  AggregatedResults,
  ElectionResult,
  GroupElement,
  // Legacy types for backward compatibility
  VoteCommitment,
  VoteBlob,
  VotePlain,
  AggregatedCommitments,
  FinalTally,
  CandidateMapping,
  VoteResult,
} from "./types";
import { PedersenCommitment } from "../crypto/pedersen";
import { ZKProofSystem } from "../crypto/zk-proofs";
import * as secp256k1 from "noble-secp256k1";

export class DecentralizedVotingSystem {
  private pedersen: PedersenCommitment;
  private zkProof: ZKProofSystem;
  private registeredVoters: Map<string, Anchor> = new Map();
  private submittedBallots: Map<string, Ballot> = new Map();
  private voterRandomness: Map<string, bigint> = new Map(); // Store randomness for each voter

  constructor() {
    this.pedersen = new PedersenCommitment();
    this.zkProof = new ZKProofSystem(this.pedersen);
  }

  /**
   * Phase 1: Voter Registration
   * Each voter creates a public randomness anchor
   * @param voterId - Unique identifier for the voter
   * @returns Registration anchor with Schnorr proof
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

    // Generate Schnorr proof of knowledge of r_i
    const zkProof = await this.zkProof.generateSchnorrProof(randomness);

    const registration: Anchor = {
      voter_id: voterId,
      anchor,
      zk_proof: zkProof,
    };

    // Store the registration
    this.registeredVoters.set(voterId, registration);

    return registration;
  }

  /**
   * Verify a voter registration
   * @param anchor - The registration anchor
   * @returns True if the registration is valid
   */
  async verifyRegistration(anchor: Anchor): Promise<boolean> {
    return await this.zkProof.verifySchnorrProof(
      anchor.anchor,
      anchor.zk_proof
    );
  }

  /**
   * Phase 2: Voting
   * Voter submits a ballot with commitment to their vote
   * @param voterId - Voter identifier
   * @param vote - Vote value (0 for NO, 1 for YES)
   * @returns Ballot with commitment and consistency proof
   */
  async castBallot(voterId: string, vote: number): Promise<Ballot> {
    // Check if voter is registered
    const registration = this.registeredVoters.get(voterId);
    if (!registration) {
      throw new Error(`Voter ${voterId} is not registered`);
    }

    // Check if voter has already voted
    if (this.submittedBallots.has(voterId)) {
      throw new Error(`Voter ${voterId} has already voted`);
    }

    // Validate vote is binary
    if (vote !== 0 && vote !== 1) {
      throw new Error("Vote must be 0 (NO) or 1 (YES)");
    }

    // Use the same randomness from registration
    const randomness = this.extractRandomnessFromRegistration(voterId);

    // Create vote commitment: C_i = g^m_i * h^r_i
    const commitment = await this.pedersen.commit(BigInt(vote), randomness);

    // Generate consistency proof showing:
    // 1. C_i and H_i use the same r_i
    // 2. m_i is in {0, 1}
    const zkProof = await this.zkProof.generateConsistencyProof(
      BigInt(vote),
      randomness,
      commitment,
      registration.anchor
    );

    const ballot: Ballot = {
      voter_id: voterId,
      commitment,
      zk_proof: zkProof,
    };

    // Store the ballot
    this.submittedBallots.set(voterId, ballot);

    return ballot;
  }

  /**
   * Verify a ballot
   * @param ballot - The ballot to verify
   * @returns True if the ballot is valid
   */
  async verifyBallot(ballot: Ballot): Promise<boolean> {
    // Check if voter is registered
    const registration = this.registeredVoters.get(ballot.voter_id);
    if (!registration) {
      return false;
    }

    // Verify consistency proof
    return await this.zkProof.verifyConsistencyProof(ballot.zk_proof);
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

    // Compute aggregate commitment: C_agg = ∏ C_i
    let C_agg = ballots[0].commitment;
    for (let i = 1; i < ballots.length; i++) {
      C_agg = await this.pedersen.addCommitments(C_agg, ballots[i].commitment);
    }

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
   * Compute the final vote count using discrete logarithm
   * @returns Election result with vote counts
   */
  async tally(): Promise<ElectionResult> {
    // Aggregate all ballots
    const aggregatedResults = await this.aggregate();

    // Compute discrete logarithm to find total YES votes
    const yesVotes = await this.computeDiscreteLog(aggregatedResults.X);

    // Total votes is the number of submitted ballots
    const totalVotes = this.submittedBallots.size;
    const noVotes = totalVotes - yesVotes;

    return {
      totalVotes,
      yesVotes,
      noVotes,
      proof: aggregatedResults,
    };
  }

  /**
   * Phase 5: Verification
   * Anyone can verify the final tally
   * @param aggregatedResults - The aggregated results
   * @param expectedYesVotes - The announced YES vote count
   * @returns True if the tally is consistent
   */
  async verifyTally(
    aggregatedResults: AggregatedResults,
    expectedYesVotes: number
  ): Promise<boolean> {
    // Verify: C_agg = g^M * H_S
    const g = this.pedersen.getGenerator();
    const g_M = g.multiply(expectedYesVotes);

    const expectedCommitment = await this.pedersen.addCommitments(
      g_M,
      aggregatedResults.H_S
    );

    return aggregatedResults.C_agg.equals(expectedCommitment);
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
   * Compute discrete logarithm using baby-step giant-step algorithm
   * @param value - The value g^M
   * @returns The exponent M
   */
  private async computeDiscreteLog(value: GroupElement): Promise<number> {
    // For small values, we can use brute force
    // In practice, for larger values, use baby-step giant-step or Pollard's rho
    const g = this.pedersen.getGenerator();

    // Limit the search to a reasonable range for voting
    // Use a more conservative limit to avoid secp256k1 scalar issues
    const maxVotes = 1000; // Conservative limit

    for (let M = 0; M < maxVotes; M++) {
      try {
        // Ensure M is within safe range for secp256k1 operations
        if (M > 1000) {
          throw new Error("Vote count too large for discrete log computation");
        }

        const g_M = g.multiply(M);
        if (g_M.equals(value)) {
          return M;
        }
      } catch (error) {
        // Continue to next iteration
      }
    }

    throw new Error("Discrete logarithm computation failed - value too large");
  }

  // Legacy methods for backward compatibility
  async createVoteCommitment(
    candidateIndex: number,
    candidateCount: number,
    randomness: bigint[]
  ): Promise<VoteCommitment> {
    throw new Error("Legacy method not supported in decentralized system");
  }

  async verifyVoteProof(
    commitments: bigint[],
    proof: any
  ): Promise<{ isValid: boolean; candidateIndex: number } | null> {
    throw new Error("Legacy method not supported in decentralized system");
  }

  async aggregateCommitments(commitmentArrays: bigint[][]): Promise<bigint[]> {
    throw new Error("Legacy method not supported in decentralized system");
  }

  async verifyFinalTally(
    aggregatedCommitments: bigint[],
    expectedTotal: number[],
    zkProof: any
  ): Promise<boolean> {
    throw new Error("Legacy method not supported in decentralized system");
  }

  async createVoteBlob(votePlain: VotePlain): Promise<VoteBlob> {
    throw new Error("Legacy method not supported in decentralized system");
  }

  extractCommitmentsFromBlobs(voteBlobs: VoteBlob[]): bigint[][] {
    throw new Error("Legacy method not supported in decentralized system");
  }

  async processVotes(voteBlobs: VoteBlob[]): Promise<FinalTally> {
    throw new Error("Legacy method not supported in decentralized system");
  }

  getVoteResults(finalTally: FinalTally): VoteResult {
    throw new Error("Legacy method not supported in decentralized system");
  }

  getCandidateMapping(): CandidateMapping {
    throw new Error("Legacy method not supported in decentralized system");
  }

  getAvailableCandidates(): string[] {
    throw new Error("Legacy method not supported in decentralized system");
  }
}
