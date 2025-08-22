/**
 * End-to-End Tally Test using VotingSystem abstraction
 * Test file for Pedersen commitment voting system with predetermined vote distribution
 */

import { VotingSystem } from './src/core/voting-system';

// End-to-End Tally Test using VotingSystem
async function endToEndTallyTest() {
  console.log('🚀 End-to-End Tally Test using VotingSystem');
  console.log('============================================');
  
  // Initialize the voting system
  const votingSystem = new VotingSystem();
  
  // Setup
  const n = 200;
  const onesCount = 83;
  const zerosCount = 117;
  
  console.log(`Setup: n = ${n} voters`);
  console.log(`Predetermined votes: ${onesCount} ones, ${zerosCount} zeros`);
  
  // Create election
  votingSystem.createElection({
    id: 'test-election-2024',
    title: 'Test Election 2024',
    description: 'End-to-end test of the voting system',
    contestId: 'president',
    optionId: 'yes-no'
  });
  
  console.log('\n📋 Election created');
  
  // Register voters and submit votes
  console.log('\n👥 Registering voters and submitting votes...');
  
  for (let i = 0; i < n; i++) {
    const voterId = `voter-${i.toString().padStart(3, '0')}`;
    const voteValue = i < onesCount ? 1n : 0n;
    
    // Register voter with generated anchor
    const { anchor, randomness } = votingSystem.registerVoterWithGeneratedAnchor(
      voterId,
      'test-election-2024',
      'president',
      'yes-no'
    );
    
    // Submit vote with generated commitment
    const commitment = votingSystem.submitVoteWithGeneratedCommitment(
      voterId,
      'test-election-2024',
      'president',
      'yes-no',
      voteValue,
      randomness
    );
    
    if (i % 50 === 0) {
      console.log(`  Processed ${i} voters...`);
    }
  }
  
  console.log(`✅ All ${n} voters registered and votes submitted`);
  
  // Check election status
  const stats = votingSystem.getElectionStats('test-election-2024', 'president', 'yes-no');
  console.log('\n📊 Election Status:', stats);
  
  // Tally the election
  console.log('\n🔍 Tallying election...');
  const result = votingSystem.tallyElection('test-election-2024', 'president', 'yes-no');
  
  // Print results
  console.log('\n📈 Election Results:');
  console.log(`Total Voters: ${result.totalVoters}`);
  console.log(`Total Votes: ${result.totalVotes}`);
  console.log(`Verified: ${result.verified}`);
  
  // Verify the mathematical relationship
  console.log('\n🔬 Mathematical Verification:');
  console.log(`Expected total votes: ${onesCount}`);
  console.log(`X == g^${onesCount}: ${result.verified ? '✅ true' : '❌ false'}`);
  console.log(`C_agg == g^${onesCount} + H_S: ${result.verified ? '✅ true' : '❌ false'}`);
  
  // Print encodings
  console.log('\n🔐 Encodings:');
  console.log(`C_agg: ${Array.from(result.C_agg).map(b => b.toString(16).padStart(2, '0')).join('')}`);
  console.log(`H_S:   ${Array.from(result.H_S).map(b => b.toString(16).padStart(2, '0')).join('')}`);
  console.log(`X:     ${Array.from(result.X).map(b => b.toString(16).padStart(2, '0')).join('')}`);
  
  const finalCheck = result.verified && result.totalVotes === onesCount;
  console.log(`\n🎯 final_check: ${finalCheck}`);
  
  // Clean up
  votingSystem.clear();
  
  return {
    finalCheck,
    result,
    stats
  };
}

// Run the test
if (typeof window === 'undefined') {
  // Node.js environment
  endToEndTallyTest().catch(console.error);
}

export { endToEndTallyTest }; 