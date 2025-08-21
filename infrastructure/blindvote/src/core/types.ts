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
  id: string;
  title: string;
  description?: string;
  options: VoteOption[];
  maxVotes?: number; // Optional: allow multiple votes per voter
  allowAbstain?: boolean; // Optional: allow abstaining
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

// Election result - now supports multiple options
export interface ElectionResult {
  totalVotes: number;
  optionResults: Record<string, number>; // Map of option ID to vote count
  proof: AggregatedResults;
}
