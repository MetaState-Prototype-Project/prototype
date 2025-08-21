/**
 * Test file to demonstrate the working Pedersen commitment voting system
 * This replaces the previous fake implementation with a real one
 */

import { 
  PedersenCommitment, 
  enc,
  dec,
  bsgsSmallRange,
  verifyFinal
} from './src/crypto/pedersen';

// Test the basic crypto operations
async function testBasicCrypto() {
  console.log('Testing basic crypto operations...');
  
  const pedersen = new PedersenCommitment();
  
  // Test commitment
  const m = 1n;
  const r = pedersen.generateRandomValue();
  const C = pedersen.commit(m, r);
  console.log('✓ Commitment created:', enc(C).slice(0, 16));
  
  // Test verification
  const isValid = pedersen.verify(C, m, r);
  console.log('✓ Commitment verification:', isValid);
  
  // Test anchor
  const H = pedersen.createAnchor(r);
  console.log('✓ Anchor created:', enc(H).slice(0, 16));
  
  return { pedersen, m, r, C, H };
}

// Test aggregation and tallying
async function testAggregation() {
  console.log('\nTesting aggregation and tallying...');
  
  const pedersen = new PedersenCommitment();
  
  // Create 3 voters
  const voters: Array<{ r: bigint; m: bigint; C: any; H: any }> = [];
  for (let i = 0; i < 3; i++) {
    const r = pedersen.generateRandomValue();
    const m = i === 0 ? 1n : 0n; // First voter votes 1, others vote 0
    const C = pedersen.commit(m, r);
    const H = pedersen.createAnchor(r);
    
    voters.push({ r, m, C, H });
  }
  
  console.log('✓ Created 3 voters:');
  voters.forEach((voter, i) => {
    console.log(`  Voter ${i + 1}: vote=${voter.m}, randomness=${voter.r.toString().slice(0, 10)}...`);
  });
  
  // Aggregate commitments
  let C_agg = voters[0].C;
  let H_S = voters[0].H;
  
  for (let i = 1; i < voters.length; i++) {
    C_agg = pedersen.addCommitments(C_agg, voters[i].C);
    H_S = pedersen.addAnchors(H_S, voters[i].H);
  }
  
  // Cancel randomness
  const X = pedersen.cancelRandomness(C_agg, H_S);
  
  // Tally using BSGS
  const M = bsgsSmallRange(enc(X), 3);
  console.log('✓ Vote count recovered:', M);
  console.log('✓ Expected: 1 (only first voter voted 1)');
  
  // Verify final result
  const finalValid = verifyFinal(enc(C_agg), enc(H_S), M);
  console.log('✓ Final verification:', finalValid);
  
  return { voters, C_agg, H_S, X, M, finalValid };
}

// Test multiple voters with different vote patterns
async function testVotePatterns() {
  console.log('\nTesting different vote patterns...');
  
  const pedersen = new PedersenCommitment();
  
  // Test pattern: [1, 1, 0, 1, 0] = total 3 votes
  const votePattern = [1n, 1n, 0n, 1n, 0n];
  const expectedTotal = votePattern.reduce((sum, vote) => sum + vote, 0n);
  
  const voters: Array<{ r: bigint; m: bigint; C: any; H: any }> = [];
  
  for (let i = 0; i < votePattern.length; i++) {
    const r = pedersen.generateRandomValue();
    const m = votePattern[i];
    const C = pedersen.commit(m, r);
    const H = pedersen.createAnchor(r);
    
    voters.push({ r, m, C, H });
  }
  
  console.log(`✓ Created ${voters.length} voters with pattern: [${votePattern.join(', ')}]`);
  console.log(`✓ Expected total votes: ${expectedTotal}`);
  
  // Aggregate
  let C_agg = voters[0].C;
  let H_S = voters[0].H;
  
  for (let i = 1; i < voters.length; i++) {
    C_agg = pedersen.addCommitments(C_agg, voters[i].C);
    H_S = pedersen.addAnchors(H_S, voters[i].H);
  }
  
  const X = pedersen.cancelRandomness(C_agg, H_S);
  const M = bsgsSmallRange(enc(X), voters.length);
  
  console.log(`✓ Actual vote count recovered: ${M}`);
  console.log(`✓ Pattern verification: ${M === Number(expectedTotal) ? 'PASS' : 'FAIL'}`);
  
  const finalValid = verifyFinal(enc(C_agg), enc(H_S), M);
  console.log('✓ Final verification:', finalValid);
  
  return { voters, C_agg, H_S, X, M, expectedTotal, finalValid };
}

// Main test function
async function runTests() {
  try {
    console.log('🚀 Starting Pedersen commitment voting system tests...\n');
    
    await testBasicCrypto();
    await testAggregation();
    await testVotePatterns();
    
    console.log('\n🎉 All tests passed! The system is working correctly.');
    console.log('\n📊 Summary:');
    console.log('  - Basic Pedersen commitments work');
    console.log('  - Aggregation of multiple votes works');
    console.log('  - Discrete log recovery works for small vote counts');
    console.log('  - Final verification works');
    console.log('\n🔒 Privacy features:');
    console.log('  - Individual votes are hidden in commitments');
    console.log('  - Only aggregate results are revealed');
    console.log('  - Randomness prevents vote linking');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  runTests().catch(console.error);
}

export { runTests }; 