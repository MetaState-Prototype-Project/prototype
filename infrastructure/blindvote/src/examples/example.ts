/**
 * Example demonstrating the decentralized voting system
 */

import { DecentralizedVotingSystem } from "../index";

async function runVotingExample() {
  console.log("Decentralized Voting System Demo");
  console.log("=================================");

  // 1. Initialize decentralized voting system
  console.log("\n1. Initializing decentralized voting system...");
  const votingSystem = new DecentralizedVotingSystem();

  // 2. Register voters
  console.log("\n2. Registering voters...");
  const voters = ["alice", "bob", "charlie", "diana", "eve"];

  for (const voter of voters) {
    const registration = await votingSystem.registerVoter(voter);
    console.log(
      `   ${voter} registered with anchor: ${registration.anchor
        .toString()
        .slice(0, 20)}...`
    );
  }

  // 3. Cast votes
  console.log("\n3. Casting votes...");
  const votes = [
    { voter: "alice", vote: 1 }, // YES
    { voter: "bob", vote: 0 }, // NO
    { voter: "charlie", vote: 1 }, // YES
    { voter: "diana", vote: 1 }, // YES
    { voter: "eve", vote: 0 }, // NO
  ];

  for (const { voter, vote } of votes) {
    const ballot = await votingSystem.castBallot(voter, vote);
    const voteText = vote === 1 ? "YES" : "NO";
    console.log(
      `   ${voter} voted ${voteText}, commitment: ${ballot.commitment
        .toString()
        .slice(0, 20)}...`
    );
  }

  // 4. Verify ballots
  console.log("\n4. Verifying ballots...");
  for (const { voter } of votes) {
    const ballot = votingSystem
      .getSubmittedBallots()
      .find((b) => b.voter_id === voter);
    if (ballot) {
      const isValid = await votingSystem.verifyBallot(ballot);
      console.log(`   ${voter}'s ballot valid: ${isValid}`);
    }
  }

  // 5. Aggregate and tally
  console.log("\n5. Aggregating and tallying votes...");
  const aggregatedResults = await votingSystem.aggregate();
  const electionResult = await votingSystem.tally();

  console.log("\nFinal Election Results:");
  console.log("------------------------");
  console.log(`   Total votes: ${electionResult.totalVotes}`);
  console.log(`   YES votes: ${electionResult.yesVotes}`);
  console.log(`   NO votes: ${electionResult.noVotes}`);
  console.log(
    `   Winner: ${
      electionResult.yesVotes > electionResult.noVotes ? "YES" : "NO"
    }`
  );

  // 6. Verify final tally
  console.log("\n6. Verifying final tally...");
  const tallyVerified = await votingSystem.verifyTally(
    aggregatedResults,
    electionResult.yesVotes
  );
  console.log(`   Tally verification: ${tallyVerified}`);

  // 7. Show system state
  console.log("\n7. System state:");
  console.log(
    `   Registered voters: ${votingSystem.getRegisteredVoters().length}`
  );
  console.log(
    `   Submitted ballots: ${votingSystem.getSubmittedBallots().length}`
  );

  for (const voter of voters) {
    const registered = votingSystem.isVoterRegistered(voter);
    const voted = votingSystem.hasVoterVoted(voter);
    console.log(`   ${voter}: registered=${registered}, voted=${voted}`);
  }
}

// Run the example
if (require.main === module) {
  runVotingExample().catch(console.error);
}

export { runVotingExample };
