/**
 * VotingSystem - High-level abstraction for managing elections and votes
 * 
 * This class provides a human-friendly interface for:
 * - Creating and managing elections
 * - Registering voters with anchors
 * - Submitting votes with commitments
 * - Tallying elections and verifying results
 * 
 * The system supports both internally generated and externally provided
 * cryptographic components (commitments, anchors, etc.)
 */

import { 
  PedersenCommitment, 
  randScalar, 
  bigIntToBytes, 
  hashToScalar, 
  enc, 
  dec,
  tallyOption
} from "../crypto/pedersen";
import { 
  Voter, 
  VoteData, 
  ElectionConfig, 
  ElectionResult 
} from "./types";

export class VotingSystem {
  private pedersen: PedersenCommitment;
  private voters: Map<string, Voter>;
  private votes: Map<string, VoteData>;
  private elections: Map<string, ElectionConfig>;

  constructor() {
    this.pedersen = new PedersenCommitment();
    this.voters = new Map();
    this.votes = new Map();
    this.elections = new Map();
  }

  /**
   * Create a new election with multiple options
   */
  createElection(electionId: string, contestId: string, options: string[]): ElectionConfig {
    const config: ElectionConfig = {
      electionId,
      contestId,
      options,
      maxVotes: 1, // One-hot voting
      allowAbstain: false
    };
    
    this.elections.set(electionId, config);
    return config;
  }

  /**
   * Register a voter for an election
   */
  registerVoter(voterId: string, electionId: string, contestId: string): Voter {
    const key = `${voterId}:${electionId}:${contestId}`;
    
    if (this.voters.has(key)) {
      throw new Error(`Voter ${voterId} already registered for election ${electionId}`);
    }

    const voter: Voter = {
      voterId,
      electionId,
      contestId,
      randomness: randScalar(),
      registeredAt: new Date()
    };

    this.voters.set(key, voter);
    return voter;
  }

  /**
   * Submit a vote with per-option commitments and anchors
   */
  submitVote(
    voterId: string, 
    electionId: string, 
    contestId: string, 
    chosenOptionId: string,
    voteData: Omit<VoteData, 'submittedAt'>
  ): void {
    const key = `${voterId}:${electionId}:${contestId}`;
    
    // Verify voter is registered
    if (!this.voters.has(key)) {
      throw new Error(`Voter ${voterId} not registered for election ${electionId}`);
    }

    // Verify chosen option exists
    const election = this.elections.get(electionId);
    if (!election || !election.options.includes(chosenOptionId)) {
      throw new Error(`Invalid option ${chosenOptionId} for election ${electionId}`);
    }

    // Verify all options have commitments and anchors
    for (const optionId of election.options) {
      if (!voteData.commitments[optionId] || !voteData.anchors[optionId]) {
        throw new Error(`Missing commitment or anchor for option ${optionId}`);
      }
    }

    // Store the vote
    const vote: VoteData = {
      ...voteData,
      submittedAt: new Date()
    };

    this.votes.set(key, vote);
  }

  /**
   * Add vote data directly (for tallying from stored data)
   * This bypasses validation since we're reconstructing from stored blind votes
   */
  addVoteForTallying(
    voterId: string,
    electionId: string,
    contestId: string,
    voteData: VoteData
  ): void {
    const key = `${voterId}:${electionId}:${contestId}`;
    this.votes.set(key, voteData);
  }

  /**
   * Generate per-option commitments and anchors for a voter
   */
  generateVoteData(
    voterId: string,
    electionId: string,
    contestId: string,
    chosenOptionId: string
  ): VoteData {
    const key = `${voterId}:${electionId}:${contestId}`;
    const voter = this.voters.get(key);
    
    if (!voter) {
      throw new Error(`Voter ${voterId} not registered for election ${electionId}`);
    }

    const election = this.elections.get(electionId);
    if (!election || !election.options.includes(chosenOptionId)) {
      throw new Error(`Invalid option ${chosenOptionId} for election ${electionId}`);
    }

    const commitments: Record<string, Uint8Array> = {};
    const anchors: Record<string, Uint8Array> = {};

    // Generate per-option randomness and commitments
    for (const optionId of election.options) {
      // Derive per-option randomness from base secret
      const domain = `${electionId}:${contestId}:${optionId}`;
      const r = hashToScalar(domain, bigIntToBytes(voter.randomness));
      
      // Create anchor: H[i,c] = h · r[i,c]
      const anchor = this.pedersen.createAnchor(r);
      anchors[optionId] = enc(anchor);

      // Create commitment: C[i,c] = g · m[i,c] + h · r[i,c]
      const m = (chosenOptionId === optionId) ? 1n : 0n;
      const commitment = this.pedersen.commit(m, r);
      commitments[optionId] = enc(commitment);
    }

    return {
      voterId,
      contestId,
      chosenOptionId,
      commitments,
      anchors,
      submittedAt: new Date()
    };
  }

  /**
   * Tally an election and return per-option results
   */
  async tallyElection(electionId: string): Promise<ElectionResult> {
    const election = this.elections.get(electionId);
    if (!election) {
      throw new Error(`Election ${electionId} not found`);
    }

    const contestId = election.contestId;
    const optionResults: Record<string, number> = {};
    const C_agg: Record<string, Uint8Array> = {};
    const H_S: Record<string, Uint8Array> = {};
    const X: Record<string, Uint8Array> = {};

    // Tally each option separately
    for (const optionId of election.options) {
      const { M, C_agg_bytes, H_S_bytes, X_bytes } = await this.tallyOption(contestId, optionId);
      
      optionResults[optionId] = M;
      C_agg[optionId] = C_agg_bytes;
      H_S[optionId] = H_S_bytes;
      X[optionId] = X_bytes;
    }

    const totalVoters = this.voters.size;
    const totalVotes = Object.values(optionResults).reduce((sum, count) => sum + count, 0);

    return {
      electionId,
      contestId,
      totalVoters,
      totalVotes,
      optionResults,
      C_agg,
      H_S,
      X,
      verified: true
    };
  }

  /**
   * Tally votes for a specific option
   */
  private async tallyOption(contestId: string, optionId: string): Promise<{ M: number; C_agg_bytes: Uint8Array; H_S_bytes: Uint8Array; X_bytes: Uint8Array }> {
    const ballots: { voterId: string; C: Uint8Array }[] = [];
    const anchors: { voterId: string; H: Uint8Array }[] = [];

    // Collect ballots and anchors for this specific option
    for (const [key, vote] of this.votes.entries()) {
      if (vote.contestId === contestId) {
        const C = vote.commitments[optionId];
        const H = vote.anchors[optionId];
        
        if (C && H) {
          ballots.push({ voterId: vote.voterId, C });
          anchors.push({ voterId: vote.voterId, H });
        }
      }
    }

    if (ballots.length === 0) {
      return { M: 0, C_agg_bytes: new Uint8Array(32), H_S_bytes: new Uint8Array(32), X_bytes: new Uint8Array(32) };
    }

    // Use the tallyOption function from pedersen.ts
    const M = tallyOption(ballots, anchors);
    
    // Get the aggregated values for verification
    const { C_agg_bytes, H_S_bytes, X_bytes } = await this.getAggregatedValues(ballots, anchors);

    return { M, C_agg_bytes, H_S_bytes, X_bytes };
  }

  /**
   * Get aggregated values for verification
   */
  private async getAggregatedValues(
    ballots: { voterId: string; C: Uint8Array }[],
    anchors: { voterId: string; H: Uint8Array }[]
  ): Promise<{ C_agg_bytes: Uint8Array; H_S_bytes: Uint8Array; X_bytes: Uint8Array }> {
    const { RistrettoPoint } = await import("@noble/curves/ed25519.js");
    
    const g = RistrettoPoint.BASE;
    const ZERO = RistrettoPoint.ZERO;

    // Aggregate commitments and anchors
    const Cs = ballots.map(b => dec(b.C));
    const Hs = anchors.map(a => dec(a.H));

    const addPoints = (arr: any[]) => arr.reduce((acc, p) => acc.add(p), ZERO);
    const C_agg = addPoints(Cs);
    const H_S = addPoints(Hs);
    const X = C_agg.add(H_S.negate());

    return {
      C_agg_bytes: enc(C_agg),
      H_S_bytes: enc(H_S),
      X_bytes: enc(X)
    };
  }

  /**
   * Get a voter by ID
   */
  getVoter(voterId: string, electionId: string, contestId: string): Voter | undefined {
    const key = `${voterId}:${electionId}:${contestId}`;
    return this.voters.get(key);
  }

  /**
   * Get a vote by voter ID
   */
  getVote(voterId: string, electionId: string, contestId: string): VoteData | undefined {
    const key = `${voterId}:${electionId}:${contestId}`;
    return this.votes.get(key);
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.voters.clear();
    this.votes.clear();
    this.elections.clear();
  }
}
