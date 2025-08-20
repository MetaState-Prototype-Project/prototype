/**
 * Privacy protection utilities for the voting system
 */

import { VoteBlob } from "../core/types";

export class PrivacyProtection {
  private static MIN_VOTES = 3; // Minimum votes before revealing results
  private static MIN_CANDIDATES = 2; // Minimum candidates for privacy

  /**
   * Validate privacy requirements before processing votes
   * @param votes - Array of vote blobs
   * @param candidates - Array of candidate names
   * @returns True if privacy requirements are met
   * @throws Error if privacy requirements are not met
   */
  static validatePrivacyRequirements(
    votes: VoteBlob[],
    candidates: string[]
  ): boolean {
    if (votes.length < this.MIN_VOTES) {
      throw new Error(
        `Insufficient votes for privacy. Need at least ${this.MIN_VOTES} votes, got ${votes.length}`
      );
    }

    if (candidates.length < this.MIN_CANDIDATES) {
      throw new Error(
        `Insufficient candidates for privacy. Need at least ${this.MIN_CANDIDATES} candidates, got ${candidates.length}`
      );
    }

    return true;
  }

  /**
   * Get the minimum vote threshold
   * @returns Minimum number of votes required
   */
  static getMinVotes(): number {
    return this.MIN_VOTES;
  }

  /**
   * Get the minimum candidate threshold
   * @returns Minimum number of candidates required
   */
  static getMinCandidates(): number {
    return this.MIN_CANDIDATES;
  }

  /**
   * Set custom privacy thresholds (for testing or configuration)
   * @param minVotes - Minimum votes required
   * @param minCandidates - Minimum candidates required
   */
  static setThresholds(minVotes: number, minCandidates: number): void {
    this.MIN_VOTES = minVotes;
    this.MIN_CANDIDATES = minCandidates;
  }
}
