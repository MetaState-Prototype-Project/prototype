/**
 * Type definitions for the decentralized privacy-preserving voting system
 * Updated to use proper Ristretto255 types and ZK proof structures
 */

import { RistrettoPoint } from '@noble/curves/ed25519.js';

// Group element type for elliptic curve operations
export type GroupElement = InstanceType<typeof RistrettoPoint>;

// Vote option interface for flexible voting
export interface VoteOption {
  id: string;
  label: string;
  value: number; // Numeric value for the option
}

// Election configuration
export interface ElectionConfig {
  electionId: string;
  contestId: string;
  options: string[]; // Array of option IDs
  maxVotes: number;
  allowAbstain: boolean;
}

// Context for domain separation
export type Ctx = { 
  electionId: string; 
  contestId: string; 
  optionId?: string; 
};

// Voter registration anchor with ZK proof
export interface Anchor {
  voterId: string;
  electionId: string;
  contestId: string;
  optionId: string;
  H: Uint8Array; // enc(RistrettoPoint)
  proofAnchor: { T: Uint8Array; s: Uint8Array };
}

// Option ballot with commitment and proofs
export interface OptionBallot {
  optionId: string;
  C: Uint8Array;
  proofConsistency: any;
  proofBit01: any;
}

// Vote ballot with commitments for all options
export interface Ballot {
  voterId: string;
  electionId: string;
  contestId: string;
  options: OptionBallot[]; // one per option, same order each time
  proofOneHot: any;
}

// Aggregated results
export interface AggregatedResults {
  C_agg: Uint8Array; // Aggregate commitment
  H_S: Uint8Array; // Aggregate anchor
  X: Uint8Array; // Final result: g^M
}

export interface Voter {
  voterId: string;
  electionId: string;
  contestId: string;
  randomness: bigint;
  registeredAt: Date;
}

export interface VoteData {
  voterId: string;
  contestId: string;
  chosenOptionId: string; // Which option the voter actually chose
  commitments: Record<string, Uint8Array>; // optionId -> commitment bytes
  anchors: Record<string, Uint8Array>;     // optionId -> anchor bytes
  submittedAt: Date;
}

// Election result - updated to match VotingSystem expectations
export interface ElectionResult {
  electionId: string;
  contestId: string;
  totalVoters: number;
  totalVotes: number;
  optionResults: Record<string, number>; // optionId -> vote count
  C_agg: Record<string, Uint8Array>;    // optionId -> aggregated commitment
  H_S: Record<string, Uint8Array>;      // optionId -> aggregated anchor
  X: Record<string, Uint8Array>;        // optionId -> randomness cancelled result
  verified: boolean;
}
