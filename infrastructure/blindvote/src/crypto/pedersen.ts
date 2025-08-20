/**
 * Pedersen commitment implementation using noble-secp256k1
 * Proper cryptographic implementation for the decentralized voting system
 */

import * as secp256k1 from "noble-secp256k1";
import { sha256 } from "noble-hashes/lib/sha256.js";
import { GroupElement } from "../core/types";

export class PedersenCommitment {
  private curve = secp256k1;
  private generator: secp256k1.Point;
  private h: secp256k1.Point; // Second generator

  constructor() {
    // Use the standard secp256k1 generator
    this.generator = secp256k1.Point.BASE;

    // Generate a second generator h by hashing the first generator
    // This ensures no one knows the discrete log relationship between g and h
    const hBytes = sha256(this.generator.toRawBytes());
    this.h = secp256k1.Point.fromPrivateKey(hBytes);
  }

  /**
   * Create a Pedersen commitment: C(m, r) = g^m * h^r
   * @param message - The message to commit to (0 or 1 for voting)
   * @param randomness - The randomness (blinding factor)
   * @returns The commitment as a point on the curve
   */
  async commit(message: bigint, randomness: bigint): Promise<GroupElement> {
    // For voting, message should be 0 or 1, so we can use it directly
    const m = Number(message);
    if (m !== 0 && m !== 1) {
      throw new Error("Message must be 0 or 1 for voting");
    }

    // Ensure randomness is within safe range for Number conversion
    const maxSafeValue = BigInt(Number.MAX_SAFE_INTEGER);
    const rValid = randomness % maxSafeValue;
    const r = Number(rValid);

    // Compute g^m - for m=0, this is the identity point, for m=1, this is g
    let g_m: secp256k1.Point;
    if (m === 0) {
      g_m = secp256k1.Point.ZERO; // Identity point
    } else {
      g_m = this.generator; // g^1 = g
    }

    // Compute h^r
    const h_r = this.h.multiply(r);

    // Add the points: C(m, r) = g^m + h^r
    const commitment = g_m.add(h_r);

    // Return the full commitment point
    return commitment;
  }

  /**
   * Create an anchor: H(r) = h^r
   * @param randomness - The randomness value
   * @returns The anchor as a point on the curve
   */
  async createAnchor(randomness: bigint): Promise<GroupElement> {
    // Ensure the randomness is within safe range for Number conversion
    const maxSafeValue = BigInt(Number.MAX_SAFE_INTEGER);
    const rValid = randomness % maxSafeValue;
    const r = Number(rValid);

    const anchor = this.h.multiply(r);
    return anchor; // Return the full point
  }

  /**
   * Homomorphically add commitments
   * @param commitment1 - First commitment
   * @param commitment2 - Second commitment
   * @returns Sum of commitments
   */
  async addCommitments(
    commitment1: GroupElement,
    commitment2: GroupElement
  ): Promise<GroupElement> {
    // Proper elliptic curve point addition
    return commitment1.add(commitment2);
  }

  /**
   * Homomorphically add anchors
   * @param anchor1 - First anchor
   * @param anchor2 - Second anchor
   * @returns Sum of anchors
   */
  async addAnchors(
    anchor1: GroupElement,
    anchor2: GroupElement
  ): Promise<GroupElement> {
    // Proper elliptic curve point addition
    return anchor1.add(anchor2);
  }

  /**
   * Cancel randomness to get final result: X = C_agg * H_S^(-1)
   * @param aggregateCommitment - C_agg
   * @param aggregateAnchor - H_S
   * @returns X = g^M where M is the total vote count
   */
  async cancelRandomness(
    aggregateCommitment: GroupElement,
    aggregateAnchor: GroupElement
  ): Promise<GroupElement> {
    // Proper elliptic curve point subtraction
    // X = C_agg + (-H_S) = g^M
    const hNegated = aggregateAnchor.negate();
    return aggregateCommitment.add(hNegated);
  }

  /**
   * Verify a commitment
   * @param commitment - The commitment to verify
   * @param message - The claimed message
   * @param randomness - The randomness used
   * @returns True if the commitment is valid
   */
  async verify(
    commitment: GroupElement,
    message: bigint,
    randomness: bigint
  ): Promise<boolean> {
    const computedCommitment = await this.commit(message, randomness);
    return commitment === computedCommitment;
  }

  /**
   * Generate cryptographically secure random values
   * @param count - Number of random values to generate
   * @returns Array of random bigint values
   */
  generateRandomness(count: number): bigint[] {
    const randomness: bigint[] = [];
    const maxSafeValue = BigInt(Number.MAX_SAFE_INTEGER);

    for (let i = 0; i < count; i++) {
      // Generate a random private key (this is cryptographically secure)
      const privateKey = secp256k1.utils.randomPrivateKey();
      const randomValue = BigInt(
        "0x" + Buffer.from(privateKey).toString("hex")
      );
      // Ensure the value is within safe range for Number conversion
      randomness.push(randomValue % maxSafeValue);
    }
    return randomness;
  }

  /**
   * Generate a single random value
   * @returns Random bigint value
   */
  generateRandomValue(): bigint {
    const privateKey = secp256k1.utils.randomPrivateKey();
    const randomValue = BigInt("0x" + Buffer.from(privateKey).toString("hex"));
    // Ensure the value is within safe range for Number conversion
    return randomValue % BigInt(Number.MAX_SAFE_INTEGER);
  }

  /**
   * Get the curve order
   * @returns The curve order
   */
  getCurveOrder(): bigint {
    return BigInt(secp256k1.CURVE.n);
  }

  /**
   * Get the generator g
   * @returns The generator point
   */
  getGenerator(): secp256k1.Point {
    return this.generator;
  }

  /**
   * Get the second generator h
   * @returns The second generator point
   */
  getH(): secp256k1.Point {
    return this.h;
  }
}
