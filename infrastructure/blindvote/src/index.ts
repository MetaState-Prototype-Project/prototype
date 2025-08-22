/**
 * BlindVote - Decentralized Privacy-Preserving Voting System
 *
 * A cryptographically secure voting system that uses Pedersen commitments
 * to ensure voter privacy while maintaining public verifiability of election results.
 *
 * Key Features:
 * - Totally decentralized (no trusted servers)
 * - Supports arbitrary vote options (not just binary yes/no)
 * - Uses Ristretto255 elliptic curve for better performance
 * - Pedersen commitments for secret ballots
 * - Public bulletin board architecture
 */

// Export the core voting system
export { VotingSystem } from "./core/voting-system";

// Export types
export type { 
  Voter, 
  VoteData, 
  ElectionConfig, 
  ElectionResult 
} from "./core/types";

// Export crypto utilities
export { 
  PedersenCommitment,
  randScalar,
  bigIntToBytes,
  hashToScalar,
  enc,
  dec,
  tallyOption,
  bsgsSmallRange
} from "./crypto/pedersen";

// Export RistrettoPoint for identity element access
export { RistrettoPoint } from "@noble/curves/ed25519.js";
