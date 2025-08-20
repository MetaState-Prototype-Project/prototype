/**
 * Example demonstrating the decentralized voting system
 * Shows the complete workflow: registration, voting, aggregation, and tallying
 */

import { DecentralizedVotingSystem } from "../core/voting-system";

async function runDecentralizedVotingExample() {
  console.log("🚀 Starting Decentralized Voting System Example\n");

  // Initialize the voting system
  const votingSystem = new DecentralizedVotingSystem();

  try {
    // Phase 1: Voter Registration
    console.log("📝 Phase 1: Voter Registration");
    console.log("================================");

    const alice = await votingSystem.registerVoter("alice");
    console.log(`✅ Alice registered with anchor: ${alice.anchor}`);

    const bob = await votingSystem.registerVoter("bob");
    console.log(`✅ Bob registered with anchor: ${bob.anchor}`);

    const charlie = await votingSystem.registerVoter("charlie");
    console.log(`✅ Charlie registered with anchor: ${charlie.anchor}`);

    const diana = await votingSystem.registerVoter("diana");
    console.log(`✅ Diana registered with anchor: ${diana.anchor}`);

    // Verify registrations
    console.log("\n🔍 Verifying registrations...");
    const aliceValid = await votingSystem.verifyRegistration(alice);
    const bobValid = await votingSystem.verifyRegistration(bob);
    const charlieValid = await votingSystem.verifyRegistration(charlie);
    const dianaValid = await votingSystem.verifyRegistration(diana);

    console.log(`Alice registration valid: ${aliceValid}`);
    console.log(`Bob registration valid: ${bobValid}`);
    console.log(`Charlie registration valid: ${charlieValid}`);
    console.log(`Diana registration valid: ${dianaValid}`);

    // Phase 2: Voting
    console.log("\n🗳️  Phase 2: Voting");
    console.log("===================");

    const aliceBallot = await votingSystem.castBallot("alice", 1); // YES
    console.log(`✅ Alice voted YES, commitment: ${aliceBallot.commitment}`);

    const bobBallot = await votingSystem.castBallot("bob", 0); // NO
    console.log(`✅ Bob voted NO, commitment: ${bobBallot.commitment}`);

    const charlieBallot = await votingSystem.castBallot("charlie", 1); // YES
    console.log(
      `✅ Charlie voted YES, commitment: ${charlieBallot.commitment}`
    );

    const dianaBallot = await votingSystem.castBallot("diana", 1); // YES
    console.log(`✅ Diana voted YES, commitment: ${dianaBallot.commitment}`);

    // Verify ballots
    console.log("\n🔍 Verifying ballots...");
    const aliceBallotValid = await votingSystem.verifyBallot(aliceBallot);
    const bobBallotValid = await votingSystem.verifyBallot(bobBallot);
    const charlieBallotValid = await votingSystem.verifyBallot(charlieBallot);
    const dianaBallotValid = await votingSystem.verifyBallot(dianaBallot);

    console.log(`Alice ballot valid: ${aliceBallotValid}`);
    console.log(`Bob ballot valid: ${bobBallotValid}`);
    console.log(`Charlie ballot valid: ${charlieBallotValid}`);
    console.log(`Diana ballot valid: ${dianaBallotValid}`);

    // Phase 3: Aggregation
    console.log("\n🔗 Phase 3: Aggregation");
    console.log("=========================");

    const aggregatedResults = await votingSystem.aggregate();
    console.log(`✅ Aggregate commitment (C_agg): ${aggregatedResults.C_agg}`);
    console.log(`✅ Aggregate anchor (H_S): ${aggregatedResults.H_S}`);
    console.log(`✅ Final result (X = g^M): ${aggregatedResults.X}`);

    // Phase 4: Tally
    console.log("\n📊 Phase 4: Tally");
    console.log("==================");

    const electionResult = await votingSystem.tally();
    console.log(`✅ Total votes: ${electionResult.totalVotes}`);
    console.log(`✅ YES votes: ${electionResult.yesVotes}`);
    console.log(`✅ NO votes: ${electionResult.noVotes}`);

    // Phase 5: Verification
    console.log("\n✅ Phase 5: Verification");
    console.log("=========================");

    const tallyVerified = await votingSystem.verifyTally(
      aggregatedResults,
      electionResult.yesVotes
    );
    console.log(`✅ Tally verification: ${tallyVerified}`);

    // Summary
    console.log("\n🎉 Election Complete!");
    console.log("=====================");
    console.log(
      `Final Result: ${electionResult.yesVotes} YES, ${electionResult.noVotes} NO`
    );
    console.log(
      `Winner: ${
        electionResult.yesVotes > electionResult.noVotes ? "YES" : "NO"
      }`
    );

    // Show system state
    console.log("\n📋 System State");
    console.log("===============");
    console.log(
      `Registered voters: ${votingSystem.getRegisteredVoters().length}`
    );
    console.log(
      `Submitted ballots: ${votingSystem.getSubmittedBallots().length}`
    );
    console.log(`Alice registered: ${votingSystem.isVoterRegistered("alice")}`);
    console.log(`Alice voted: ${votingSystem.hasVoterVoted("alice")}`);
  } catch (error) {
    console.error("❌ Error in voting system:", error);
  }
}

// Run the example
if (require.main === module) {
  runDecentralizedVotingExample().catch(console.error);
}

export { runDecentralizedVotingExample };
