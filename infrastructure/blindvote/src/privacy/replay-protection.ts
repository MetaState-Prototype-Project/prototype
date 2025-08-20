/**
 * Replay protection utilities for the voting system
 */

export class ReplayProtection {
  private static usedRandomness = new Set<string>();
  private static usedCommitments = new Set<string>();

  /**
   * Check if randomness has been used before (replay detection)
   * @param randomness - Array of randomness values
   * @returns True if randomness is unique (no replay)
   * @throws Error if replay is detected
   */
  static verifyNoReplay(randomness: bigint[]): boolean {
    const key = randomness.map((r) => r.toString()).join(",");

    if (this.usedRandomness.has(key)) {
      throw new Error("Replay attack detected: randomness already used");
    }

    this.usedRandomness.add(key);
    return true;
  }

  /**
   * Check if commitment has been used before
   * @param commitments - Array of commitment values
   * @returns True if commitments are unique
   * @throws Error if replay is detected
   */
  static verifyCommitmentUnique(commitments: bigint[]): boolean {
    const key = commitments.map((c) => c.toString()).join(",");

    if (this.usedCommitments.has(key)) {
      throw new Error("Replay attack detected: commitment already used");
    }

    this.usedCommitments.add(key);
    return true;
  }

  /**
   * Generate unique randomness with replay protection
   * @param count - Number of randomness values to generate
   * @returns Array of unique randomness values
   */
  static generateUniqueRandomness(count: number): bigint[] {
    let attempts = 0;
    const maxAttempts = 1000;

    while (attempts < maxAttempts) {
      const randomness: bigint[] = [];

      for (let i = 0; i < count; i++) {
        const random = BigInt(
          Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
        );
        randomness.push(random);
      }

      try {
        this.verifyNoReplay(randomness);
        return randomness;
      } catch {
        attempts++;
      }
    }

    throw new Error(
      "Failed to generate unique randomness after maximum attempts"
    );
  }

  /**
   * Clear all stored randomness and commitments (for testing)
   */
  static clear(): void {
    this.usedRandomness.clear();
    this.usedCommitments.clear();
  }

  /**
   * Get statistics about replay protection
   * @returns Object with statistics
   */
  static getStatistics(): {
    uniqueRandomnessCount: number;
    uniqueCommitmentsCount: number;
  } {
    return {
      uniqueRandomnessCount: this.usedRandomness.size,
      uniqueCommitmentsCount: this.usedCommitments.size,
    };
  }

  /**
   * Check if a specific randomness combination has been used
   * @param randomness - Array of randomness values to check
   * @returns True if randomness has been used before
   */
  static hasRandomnessBeenUsed(randomness: bigint[]): boolean {
    const key = randomness.map((r) => r.toString()).join(",");
    return this.usedRandomness.has(key);
  }

  /**
   * Check if a specific commitment combination has been used
   * @param commitments - Array of commitment values to check
   * @returns True if commitment has been used before
   */
  static hasCommitmentBeenUsed(commitments: bigint[]): boolean {
    const key = commitments.map((c) => c.toString()).join(",");
    return this.usedCommitments.has(key);
  }
}
