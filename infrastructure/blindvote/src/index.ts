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

// Core system
export * from "./core/types";
export * from "./core/voting-system";

// Cryptographic primitives - only export the main class and types
export { PedersenCommitment, GroupElement, ScalarType, Ctx } from "./crypto/pedersen";
export { randScalar, bigIntToBytes, hashToScalar, enc, dec, bsgsSmallRange, verifyFinal } from "./crypto/pedersen";
