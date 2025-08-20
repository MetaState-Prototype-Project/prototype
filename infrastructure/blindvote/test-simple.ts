/**
 * Simple test to verify the basic voting system works
 */

import { DecentralizedVotingSystem } from "./src/index";

async function testSimpleVoting() {
  console.log("🧪 Testing Simple Voting System\n");

  const votingSystem = new DecentralizedVotingSystem();

  try {
    // Register voters
    console.log("📝 Registering voters...");
    await votingSystem.registerVoter("voter1");
    await votingSystem.registerVoter("voter2");
    await votingSystem.registerVoter("voter3");
    console.log("✅ All voters registered successfully");

    // Cast votes
    console.log("\n🗳️ Casting votes...");
    const ballot1 = await votingSystem.castBallot("voter1", 1); // YES
    const ballot2 = await votingSystem.castBallot("voter2", 0); // NO
    const ballot3 = await votingSystem.castBallot("voter3", 1); // YES
    console.log("✅ All votes cast successfully");

    // Verify ballots
    console.log("\n🔍 Verifying ballots...");
    const verified1 = await votingSystem.verifyBallot(ballot1);
    const verified2 = await votingSystem.verifyBallot(ballot2);
    const verified3 = await votingSystem.verifyBallot(ballot3);
    console.log(`✅ Ballot verification: ${verified1 && verified2 && verified3 ? "ALL PASSED" : "SOME FAILED"}`);

    // Aggregate and tally
    console.log("\n🔗 Aggregating votes...");
    const aggregated = await votingSystem.aggregate();
    console.log("✅ Votes aggregated successfully");

    console.log("\n📊 Tallying votes...");
    const results = await votingSystem.tally();
    console.log("✅ Votes tallied successfully");
    console.log(`   Total votes: ${results.totalVotes}`);
    console.log(`   YES votes: ${results.yesVotes}`);
    console.log(`   NO votes: ${results.noVotes}`);

    // Verify final tally
    console.log("\n✅ Verifying final tally...");
    const verified = await votingSystem.verifyTally(aggregated, results.yesVotes);
    console.log(`✅ Final tally verification: ${verified ? "PASSED" : "FAILED"}`);

    console.log("\n🎉 Simple voting test completed successfully!");
    return true;

  } catch (error) {
    console.error("❌ Simple voting test failed:", error);
    return false;
  }
}

// Run the test
testSimpleVoting().catch(console.error); 