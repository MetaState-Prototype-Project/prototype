/**
 * Batch processing utilities for decentralized vote aggregation
 */

import { Ballot, AggregatedResults } from "../core/types";
import { DecentralizedVotingSystem } from "../core/voting-system";
import * as secp256k1 from "noble-secp256k1";

export class BatchProcessor {
  private static DEFAULT_BATCH_SIZE = 25;

  /**
   * Process votes in batches for enhanced privacy
   * @param ballots - Array of ballots
   * @param votingSystem - Decentralized voting system instance
   * @param batchSize - Size of each batch (default: 25)
   * @returns Array of aggregated results from each batch
   */
  static async processInBatches(
    ballots: Ballot[],
    votingSystem: DecentralizedVotingSystem,
    batchSize: number = this.DEFAULT_BATCH_SIZE
  ): Promise<AggregatedResults[]> {
    const batches = this.createBatches(ballots, batchSize);
    const results: AggregatedResults[] = [];

    for (let i = 0; i < batches.length; i++) {
      console.log(
        `Processing batch ${i + 1}/${batches.length} (${
          batches[i].length
        } ballots)`
      );

      // For each batch, we need to simulate the aggregation process
      // Since the decentralized system aggregates all ballots at once,
      // we'll create a temporary system for each batch
      const batchSystem = new DecentralizedVotingSystem();

      // Add ballots to the batch system
      for (const ballot of batches[i]) {
        // We need to reconstruct the registration for each voter
        // This is a simplified approach - in practice, you'd need the actual registrations
        console.log(`Processing ballot for voter: ${ballot.voter_id}`);
      }

      // For now, return a placeholder result
      // In a real implementation, you'd aggregate the batch properly
      results.push({
        C_agg: secp256k1.Point.ZERO,
        H_S: secp256k1.Point.ZERO,
        X: secp256k1.Point.ZERO,
      });
    }

    return results;
  }

  /**
   * Create batches from ballot array
   * @param ballots - Array of ballots
   * @param batchSize - Size of each batch
   * @returns Array of ballot batches
   */
  private static createBatches(
    ballots: Ballot[],
    batchSize: number
  ): Ballot[][] {
    const batches: Ballot[][] = [];

    for (let i = 0; i < ballots.length; i += batchSize) {
      batches.push(ballots.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Aggregate batch results into final result
   * @param batchResults - Array of aggregated results from batches
   * @returns Final aggregated result
   */
  static aggregateBatchResults(
    batchResults: AggregatedResults[]
  ): AggregatedResults {
    if (batchResults.length === 0) {
      return {
        C_agg: secp256k1.Point.ZERO,
        H_S: secp256k1.Point.ZERO,
        X: secp256k1.Point.ZERO,
      };
    }

    // In the decentralized system, aggregation is done differently
    // This is a placeholder implementation
    return batchResults[0];
  }

  /**
   * Get optimal batch size based on ballot count
   * @param totalBallots - Total number of ballots
   * @returns Recommended batch size
   */
  static getOptimalBatchSize(totalBallots: number): number {
    if (totalBallots <= 50) {
      return 10; // Small ballot sets: smaller batches
    } else if (totalBallots <= 200) {
      return 25; // Medium ballot sets: medium batches
    } else {
      return 50; // Large ballot sets: larger batches
    }
  }

  /**
   * Process ballots with privacy protection
   * @param ballots - Array of ballots to process
   * @param votingSystem - Decentralized voting system instance
   * @returns Aggregated results
   */
  static async processBallotsWithPrivacy(
    ballots: Ballot[],
    votingSystem: DecentralizedVotingSystem
  ): Promise<AggregatedResults> {
    // In the decentralized system, we aggregate all ballots at once
    // This provides better privacy as all votes are mixed together
    return await votingSystem.aggregate();
  }

  /**
   * Validate batch integrity
   * @param ballots - Array of ballots to validate
   * @returns True if all ballots are valid
   */
  static async validateBatch(
    ballots: Ballot[],
    votingSystem: DecentralizedVotingSystem
  ): Promise<boolean> {
    for (const ballot of ballots) {
      const isValid = await votingSystem.verifyBallot(ballot);
      if (!isValid) {
        console.error(`Invalid ballot detected for voter: ${ballot.voter_id}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Get batch statistics
   * @param ballots - Array of ballots
   * @returns Statistics about the batch
   */
  static getBatchStats(ballots: Ballot[]): {
    totalBallots: number;
    uniqueVoters: number;
    batchCount: number;
    averageBatchSize: number;
  } {
    const uniqueVoters = new Set(ballots.map((b) => b.voter_id)).size;
    const totalBallots = ballots.length;
    const batchCount = Math.ceil(totalBallots / this.DEFAULT_BATCH_SIZE);
    const averageBatchSize = totalBallots / batchCount;

    return {
      totalBallots,
      uniqueVoters,
      batchCount,
      averageBatchSize,
    };
  }
}
