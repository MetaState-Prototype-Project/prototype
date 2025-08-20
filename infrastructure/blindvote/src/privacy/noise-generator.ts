/**
 * Noise generation utilities for differential privacy
 */

export class NoiseGenerator {
  /**
   * Add Laplace noise to vote results for differential privacy
   * @param results - Array of vote counts
   * @param epsilon - Privacy parameter (lower = more privacy, higher = less noise)
   * @returns Array of noisy vote counts
   */
  static addLaplaceNoise(results: number[], epsilon: number = 1.0): number[] {
    return results.map((count) => {
      const noise = this.laplaceRandom(0, 1 / epsilon);
      const noisyCount = count + noise;
      return Math.max(0, Math.round(noisyCount)); // Ensure non-negative
    });
  }

  /**
   * Generate Laplace distributed random number
   * @param mean - Mean of the distribution
   * @param scale - Scale parameter (b in Laplace distribution)
   * @returns Random number from Laplace distribution
   */
  private static laplaceRandom(mean: number, scale: number): number {
    const u = Math.random() - 0.5;
    return mean - scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Add Gaussian noise to vote results (alternative to Laplace)
   * @param results - Array of vote counts
   * @param sigma - Standard deviation of noise
   * @returns Array of noisy vote counts
   */
  static addGaussianNoise(results: number[], sigma: number = 1.0): number[] {
    return results.map((count) => {
      const noise = this.gaussianRandom(0, sigma);
      const noisyCount = count + noise;
      return Math.max(0, Math.round(noisyCount)); // Ensure non-negative
    });
  }

  /**
   * Generate Gaussian distributed random number using Box-Muller transform
   * @param mean - Mean of the distribution
   * @param sigma - Standard deviation
   * @returns Random number from Gaussian distribution
   */
  private static gaussianRandom(mean: number, sigma: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + sigma * z0;
  }

  /**
   * Calculate privacy budget for multiple queries
   * @param epsilon - Privacy parameter for single query
   * @param numQueries - Number of queries
   * @returns Total privacy budget consumed
   */
  static calculatePrivacyBudget(epsilon: number, numQueries: number): number {
    return epsilon * numQueries;
  }

  /**
   * Check if privacy budget is exceeded
   * @param currentBudget - Current privacy budget used
   * @param maxBudget - Maximum allowed privacy budget
   * @returns True if budget is exceeded
   */
  static isPrivacyBudgetExceeded(
    currentBudget: number,
    maxBudget: number
  ): boolean {
    return currentBudget > maxBudget;
  }

  /**
   * Get recommended epsilon values for different privacy levels
   * @returns Object with epsilon values for different privacy levels
   */
  static getRecommendedEpsilon(): { [key: string]: number } {
    return {
      high: 0.1, // Very high privacy, lots of noise
      medium: 1.0, // Medium privacy, moderate noise
      low: 10.0, // Low privacy, little noise
      minimal: 100.0, // Minimal privacy, very little noise
    };
  }
}
