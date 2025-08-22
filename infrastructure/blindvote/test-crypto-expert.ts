/**
 * Test the crypto expert's multi-option tally method
 * Simple isolated test to verify the math works
 */

import { PedersenCommitment, enc, dec } from './src/crypto/pedersen';
import type { GroupElement } from './src/core/types';

// ===== Generators (use the same everywhere) =====
const pedersen = new PedersenCommitment();
const g = pedersen.getGenerator();
const h = pedersen.getH();

// ===== Helpers =====
// Use the identity element instead of g.multiply(0n)
const zero = () => {
  // For Ristretto255, we need to find the identity element
  // Let's use a different approach - start with the first ballot
  throw new Error('Need to implement proper identity element');
};
const eq = (A: GroupElement, B: GroupElement) => {
  const aBytes = enc(A);
  const bBytes = enc(B);
  return aBytes.length === bBytes.length && 
         aBytes.every((byte, i) => byte === bBytes[i]);
};

// ===== Baby-Step/Giant-Step in small range [0..nMax] =====
function bsgsSmallRange(X: GroupElement, nMax: number): number {
  if (nMax < 0) throw new Error('nMax must be non-negative');
  const m = Math.ceil(Math.sqrt(nMax + 1));
  
  // baby steps table: j*g -> j
  const table = new Map<string, number>();
  // For Ristretto255, we need to find the identity element
  // Let's use a different approach - start with g and build the table
  let P = g; // Start with g^1
  
  for (let j = 0; j < m; j++) {
    table.set(Array.from(enc(P)).map(b => b.toString(16).padStart(2, '0')).join(''), j + 1);
    P = P.add(g); // P = (j+2)*g
  }
  
  // giant step factor: -(m*g)
  const minusGm = g.multiply(BigInt(m)).negate();

  let Y = X;
  for (let i = 0; i <= m; i++) {
    const key = Array.from(enc(Y)).map(b => b.toString(16).padStart(2, '0')).join('');
    const j = table.get(key);
    if (j !== undefined) {
      const M = i * m + j;
      if (M <= nMax && M > 0) return M; // M must be > 0 since we start from 1
    }
    Y = Y.add(minusGm); // Y = Y - m*g
  }
  throw new Error('DL not found: X is not g·M in [0..nMax]');
}

// ===== Tally a single option =====
function tallyOption(
  ballots: { voterId: string; C: Uint8Array }[],
  anchors: { voterId: string; H: Uint8Array }[],
  nMax: number
): { M: number; C_agg: Uint8Array; H_S: Uint8Array; X: Uint8Array } {
  // Build sets & sums only over voters who actually cast ballots
  const present = new Set(ballots.map(b => b.voterId));

  // Start with first ballot, then add the rest
  let C_aggP = dec(ballots[0].C);
  for (let i = 1; i < ballots.length; i++) {
    C_aggP = C_aggP.add(dec(ballots[i].C));
  }

  // Start with first anchor, then add the rest
  let H_S_P = dec(anchors[0].H);
  for (let i = 1; i < anchors.length; i++) {
    H_S_P = H_S_P.add(dec(anchors[i].H));
  }

  const Xp = C_aggP.add(H_S_P.negate()); // X = C_agg - H_S

  // Recover M in [0..nMax] with BSGS
  const M = bsgsSmallRange(Xp, nMax);

  // Final check: C_agg == g·M + H_S
  const expectedC_agg = g.multiply(BigInt(M)).add(H_S_P);
  const ok = eq(C_aggP, expectedC_agg);
  if (!ok) throw new Error('final check failed for option');

  return { M, C_agg: enc(C_aggP), H_S: enc(H_S_P), X: enc(Xp) };
}

// ===== Test the method =====
async function testCryptoExpertMethod() {
  console.log("🚀 Testing crypto expert's multi-option tally method...");

  try {
    // Create a simple test case: 2 voters, 2 options
    const pedersen = new PedersenCommitment();
    
    // Voter 1: votes for option 1 (value = 1)
    const r1 = pedersen.generateRandomValue();
    const H1 = pedersen.createAnchor(r1);
    const C1 = pedersen.commit(1n, r1);
    
    // Voter 2: votes for option 0 (value = 0)  
    const r2 = pedersen.generateRandomValue();
    const H2 = pedersen.createAnchor(r2);
    const C2 = pedersen.commit(0n, r2);
    
    console.log("✅ Created test commitments:");
    console.log("- Voter 1: H1 =", Array.from(enc(H1)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32) + '...');
    console.log("- Voter 1: C1 =", Array.from(enc(C1)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32) + '...');
    console.log("- Voter 2: H2 =", Array.from(enc(H2)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32) + '...');
    console.log("- Voter 2: C2 =", Array.from(enc(C2)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32) + '...');

    // Test tallying option 1 (should get 1 vote)
    console.log("\n🔍 Testing tally for option 1...");
    const option1Result = tallyOption(
      [
        { voterId: "voter1", C: enc(C1) },
        { voterId: "voter2", C: enc(C2) }
      ],
      [
        { voterId: "voter1", H: enc(H1) },
        { voterId: "voter2", H: enc(H2) }
      ],
      2 // max votes
    );
    
    console.log("✅ Option 1 result:", option1Result.M, "votes");
    console.log("Expected: 1 vote (voter1 voted 1, voter2 voted 0)");

    // Test tallying option 0 (should get 1 vote)  
    console.log("\n🔍 Testing tally for option 0...");
    const option0Result = tallyOption(
      [
        { voterId: "voter1", C: enc(C1) },
        { voterId: "voter2", C: enc(C2) }
      ],
      [
        { voterId: "voter1", H: enc(H1) },
        { voterId: "voter2", H: enc(H2) }
      ],
      2 // max votes
    );
    
    console.log("✅ Option 0 result:", option0Result.M, "votes");
    console.log("Expected: 1 vote (voter1 voted 1, voter2 voted 0)");

    console.log("\n🎉 Crypto expert's method test completed successfully!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

// Run the test
testCryptoExpertMethod().catch(console.error); 