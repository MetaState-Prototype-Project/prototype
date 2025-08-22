/**
 * Pedersen commitment implementation using @noble/curves/ed25519 (Ristretto255)
 * Proper cryptographic implementation for the decentralized voting system
 * Based on the AI Expert specification
 */

import { RistrettoPoint } from '@noble/curves/ed25519.js';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha2.js';

// Browser-compatible random bytes
function getRandomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array;
}

// Type definitions
export type GroupElement = InstanceType<typeof RistrettoPoint>;
export type ScalarType = bigint;

// Context for domain separation
export type Ctx = { 
  electionId: string; 
  contestId: string; 
  optionId?: string; 
};

// Helpers
export function randScalar(): bigint {
  // Use the actual curve order from RistrettoPoint
  const q = RistrettoPoint.Fn.ORDER;
  let x: bigint;
  do {
    x = bytesToBigInt(getRandomBytes(64)) % q;
  } while (x === 0n || x >= q);
  return x;
}

function bytesToBigInt(b: Uint8Array): bigint {
  let v = 0n;
  for (const x of b) v = (v << 8n) + BigInt(x);
  return v;
}

export function bigIntToBytes(x: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(x & 0xffn);
    x = x >> 8n;
  }
  return bytes;
}

// Domain-separated hash to scalar
export function hashToScalar(domain: string, ...parts: Uint8Array[]): bigint {
  const mac = hmac.create(sha512, new TextEncoder().encode(domain));
  for (const p of parts) mac.update(p);
  const digest = mac.digest();
  const q = RistrettoPoint.Fn.ORDER;
  return bytesToBigInt(digest) % q;
}

// Generators g and h
const g = RistrettoPoint.BASE;
const domainBytes = new TextEncoder().encode('auvo/vote/h-generator/v1');
const paddedDomain = new Uint8Array(64);
paddedDomain.set(domainBytes.slice(0, 64));
const h = RistrettoPoint.hashToCurve(paddedDomain);

// Encoding helpers
export const enc = (P: InstanceType<typeof RistrettoPoint>): Uint8Array => P.toRawBytes();
export const dec = (b: Uint8Array): InstanceType<typeof RistrettoPoint> => RistrettoPoint.fromBytes(b);

export class PedersenCommitment {
  /**
   * Create a Pedersen commitment: C(m, r) = g^m * h^r
   */
  commit(m: bigint, r: bigint): InstanceType<typeof RistrettoPoint> {
    // Ensure m is a valid scalar (0 or 1 for voting)
    if (m !== 0n && m !== 1n) {
      throw new Error('Vote value must be 0 or 1');
    }
    
    // Ensure r is within valid range
    const rValid = r % RistrettoPoint.Fn.ORDER;
    if (rValid === 0n) {
      throw new Error('Randomness cannot be 0');
    }
    
    if (m === 0n) {
      // For m=0: C = h^r (no g component)
      return h.multiply(rValid);
    } else {
      // For m=1: C = g + h^r
      return g.add(h.multiply(rValid));
    }
  }

  /**
   * Create an anchor: H(r) = h^r
   */
  createAnchor(r: bigint): InstanceType<typeof RistrettoPoint> {
    // Ensure r is within valid range
    const rValid = r % RistrettoPoint.Fn.ORDER;
    if (rValid === 0n) {
      throw new Error('Randomness cannot be 0');
    }
    return h.multiply(rValid);
  }

  /**
   * Homomorphically add commitments
   */
  addCommitments(c1: InstanceType<typeof RistrettoPoint>, c2: InstanceType<typeof RistrettoPoint>): InstanceType<typeof RistrettoPoint> {
    return c1.add(c2);
  }

  /**
   * Homomorphically add anchors
   */
  addAnchors(a1: InstanceType<typeof RistrettoPoint>, a2: InstanceType<typeof RistrettoPoint>): InstanceType<typeof RistrettoPoint> {
    return a1.add(a2);
  }

  /**
   * Cancel randomness: X = C_agg * H_S^(-1) = g^M
   */
  cancelRandomness(C_agg: InstanceType<typeof RistrettoPoint>, H_S: InstanceType<typeof RistrettoPoint>): InstanceType<typeof RistrettoPoint> {
    return C_agg.add(H_S.negate());
  }

  /**
   * Verify a commitment
   */
  verify(commitment: InstanceType<typeof RistrettoPoint>, m: bigint, r: bigint): boolean {
    const computedCommitment = this.commit(m, r);
    return commitment.equals(computedCommitment);
  }

  /**
   * Get the curve order
   */
  getCurveOrder(): bigint {
    return RistrettoPoint.Fn.ORDER;
  }

  /**
   * Get the generator g
   */
  getGenerator(): InstanceType<typeof RistrettoPoint> {
    return g;
  }

  /**
   * Get the second generator h
   */
  getH(): InstanceType<typeof RistrettoPoint> {
    return h;
  }

  /**
   * Generate cryptographically secure random values
   */
  generateRandomness(count: number): bigint[] {
    const randomness: bigint[] = [];
    for (let i = 0; i < count; i++) {
      randomness.push(randScalar());
    }
    return randomness;
  }

  /**
   * Generate a single random value
   */
  generateRandomValue(): bigint {
    return randScalar();
  }
}

// Schnorr proof for anchor H = h^r
export function proveAnchor(H: InstanceType<typeof RistrettoPoint>, r: bigint, ctx: Ctx) {
  const k = randScalar();
  const T = h.multiply(k);
  const e = hashToScalar(`anchor/v1|${ctx.electionId}|${ctx.contestId}|${ctx.optionId}`,
    h.toRawBytes(), H.toRawBytes(), T.toRawBytes());
  const s = (k + e * r) % RistrettoPoint.Fn.ORDER;
  return { T: enc(T), s: bigIntToBytes(s) };
}

export function verifyAnchor(Hb: Uint8Array, proof: { T: Uint8Array; s: Uint8Array; }, ctx: Ctx): boolean {
  try {
    const H = dec(Hb), T = dec(proof.T);
    const s = bytesToBigInt(proof.s);
    const e = hashToScalar(`anchor/v1|${ctx.electionId}|${ctx.contestId}|${ctx.optionId}`,
      h.toRawBytes(), H.toRawBytes(), T.toRawBytes());
    
    // check: h^s ?= T * H^e
    const lhs = h.multiply(s);
    const rhs = T.add(H.multiply(e));
    return enc(lhs).toString() === enc(rhs).toString();
  } catch {
    return false;
  }
}

// Baby-step/Giant-step for small-range discrete log
export function bsgsSmallRange(Xb: Uint8Array, nMax: number): number {
  const X = dec(Xb);
  const m = Math.ceil(Math.sqrt(nMax + 1));
  
  // Check for M=0 case first
  if (X.equals(RistrettoPoint.ZERO)) {
    return 0;
  }
  
  // baby steps: table[g^j] = j
  const table = new Map<string, number>();
  let P = g; // Start with g^1, not g^0
  for (let j = 1; j <= m; j++) {
    table.set(enc(P).toString(), j);
    P = P.add(g);
  }
  
  // precompute g^-m (use positive scalar)
  const GmInv = g.multiply(BigInt(m)).negate();
  let Y = X;
  
  for (let i = 0; i <= m; i++) {
    const key = enc(Y).toString();
    const j = table.get(key);
    if (j !== undefined) {
      const M = i * m + j;
      if (M <= nMax) return M;
    }
    Y = Y.add(GmInv);
  }
  
  throw new Error('small-range DL not found (bad inputs)');
}

/**
 * Tally votes for a single option using Crypto Daddy's algorithm
 */
export function tallyOption(
  ballots: { voterId: string; C: Uint8Array }[],
  anchors: { voterId: string; H: Uint8Array }[]
): number {
  // only anchors for voters who actually cast
  const present = new Set(ballots.map(b => b.voterId));
  const Cs = ballots.map(b => dec(b.C));
  const Hs = anchors.filter(a => present.has(a.voterId)).map(a => dec(a.H));
  
  if (Cs.length !== Hs.length) {
    throw new Error('anchor/ballot mismatch for this option');
  }

  const C_agg = addPoints(Cs);
  const H_S = addPoints(Hs);
  const X = C_agg.add(H_S.negate());     // X = g · M

  const nMax = Cs.length;                    // votes in this contest
  const M = bsgsSmallRange(enc(X), nMax);   // Encode X before passing to bsgsSmallRange

  // must pass - handle M=0 case specially
  let expectedC_agg;
  if (M === 0) {
    expectedC_agg = H_S; // For M=0: C_agg = H_S (no g component)
  } else {
    expectedC_agg = g.multiply(BigInt(M)).add(H_S); // For M>0: C_agg = g^M + H_S
  }
  
  const ok = encEq(C_agg, expectedC_agg);
  if (!ok) throw new Error('final check failed');
  return M;
}

/**
 * Helper function to add points
 */
function addPoints(arr: any[]) { 
  return arr.reduce((acc, p) => acc.add(p), RistrettoPoint.ZERO); 
}

/**
 * Helper function to compare encodings
 */
function encEq(A: any, B: any) { 
  const bytesA = A.toRawBytes();
  const bytesB = B.toRawBytes();
  
  if (bytesA.length !== bytesB.length) return false;
  
  for (let i = 0; i < bytesA.length; i++) {
    if (bytesA[i] !== bytesB[i]) return false;
  }
  
  return true;
}

export function verifyFinal(C_aggb: Uint8Array, H_Sb: Uint8Array, M: number): boolean {
  try {
    const C_agg = dec(C_aggb), H_S = dec(H_Sb);
    const gM = g.multiply(BigInt(M));
    return enc(C_agg).toString() === enc(gM.add(H_S)).toString();
  } catch {
    return false;
  }
}
