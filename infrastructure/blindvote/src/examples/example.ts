/**
 * Example usage of the VotingSystem for privacy-preserving voting
 */

import { VotingSystem } from "../core/voting-system";

async function main() {
  console.log("🚀 Starting Blind Voting System Demo...\n");

  const votingSystem = new VotingSystem();

  // Create an election with multiple options
  const electionId = "election-2024";
  const contestId = "president";
  const options = ["candidate-a", "candidate-b", "candidate-c"];
  
  const election = votingSystem.createElection(electionId, contestId, options);
  console.log(`✅ Election created: ${electionId} with ${options.length} options`);

  // Register voters
  const voter1 = votingSystem.registerVoter("voter-1", electionId, contestId);
  const voter2 = votingSystem.registerVoter("voter-2", electionId, contestId);
  const voter3 = votingSystem.registerVoter("voter-3", electionId, contestId);
  
  console.log(`✅ Registered ${3} voters`);

  // Generate vote data for each voter
  console.log("\n🗳️ Generating votes...");
  
  // Voter 1 votes for candidate-a
  const voteData1 = votingSystem.generateVoteData("voter-1", electionId, contestId, "candidate-a");
  votingSystem.submitVote("voter-1", electionId, contestId, "candidate-a", voteData1);
  console.log(`✅ Voter 1 voted for candidate-a`);

  // Voter 2 votes for candidate-b  
  const voteData2 = votingSystem.generateVoteData("voter-2", electionId, contestId, "candidate-b");
  votingSystem.submitVote("voter-2", electionId, contestId, "candidate-b", voteData2);
  console.log(`✅ Voter 2 voted for candidate-b`);

  // Voter 3 votes for candidate-a
  const voteData3 = votingSystem.generateVoteData("voter-3", electionId, contestId, "candidate-a");
  votingSystem.submitVote("voter-3", electionId, contestId, "candidate-a", voteData3);
  console.log(`✅ Voter 3 voted for candidate-a`);

  // Tally the election
  console.log("\n🔍 Tallying election...");
  const result = await votingSystem.tallyElection(electionId);

  console.log("\n📊 Election Results:");
  console.log(`- Total Voters: ${result.totalVoters}`);
  console.log(`- Total Votes: ${result.totalVotes}`);
  console.log(`- Verified: ${result.verified}`);
  
  console.log("\n📈 Per-Option Results:");
  for (const [optionId, voteCount] of Object.entries(result.optionResults)) {
    console.log(`  ${optionId}: ${voteCount} votes`);
  }

  console.log("\n🔐 Cryptographic Values:");
  for (const [optionId, C_agg] of Object.entries(result.C_agg)) {
    console.log(`  ${optionId} C_agg: ${Array.from(C_agg).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32)}...`);
  }

  console.log("\n✅ Demo completed successfully!");
}

main().catch(console.error);
