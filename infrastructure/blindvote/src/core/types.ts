/**
 * Type definitions for the decentralized privacy-preserving voting system
 */

// Import secp256k1 for proper point types
import * as secp256k1 from "noble-secp256k1";

// Group element type for elliptic curve operations
export type GroupElement = secp256k1.Point; // Use actual EC points instead of bigint

// Schnorr proof for registration
export interface SchnorrProof {
  challenge: bigint;
  response: bigint;
  commitment: GroupElement;
}

// Voter registration anchor
export interface Anchor {
  voter_id: string;
  anchor: GroupElement; // H_i = h^r_i
  zk_proof: SchnorrProof;
}

// Vote ballot with commitment
export interface Ballot {
  voter_id: string;
  commitment: GroupElement; // C_i = g^m_i * h^r_i
  zk_proof: ConsistencyProof;
}

// ZK proof showing consistency between commitment and anchor
export interface ConsistencyProof {
  // Proof that C_i and H_i use the same r_i
  // AND that m_i is in {0, 1}
  proofData: string;
  publicInputs: GroupElement[];
}

// Aggregated results
export interface AggregatedResults {
  C_agg: GroupElement; // Aggregate commitment
  H_S: GroupElement; // Aggregate anchor
  X: GroupElement; // Final result: g^M
}

// Election result
export interface ElectionResult {
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  proof: AggregatedResults;
}

// Legacy types for backward compatibility
export interface VoteCommitment {
  commitments: bigint[];
  proof: ZKProof;
  candidateCount: number;
}

export interface ZKProof {
  // Simplified ZK proof structure
  // In a real implementation, this would contain the actual proof data
  proofData: string;
  publicInputs: bigint[];
}

export interface VoteBlob {
  commitment: VoteCommitment;
  timestamp: Date;
  signature?: string;
}

export interface VotePlain {
  candidate: string;
  timestamp: Date;
}

export interface AggregatedCommitments {
  commitments: bigint[];
  proof: ZKProof;
  candidateCount: number;
}

export interface FinalTally {
  results: number[];
  proof: ZKProof;
  candidateMapping: Record<string, number>;
}

export interface CandidateMapping {
  [candidate: string]: number;
}

export interface VoteResult {
  [candidate: string]: number;
}
