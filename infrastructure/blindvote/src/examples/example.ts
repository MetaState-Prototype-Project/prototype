/**
 * Example demonstrating the decentralized voting system with flexible vote options
 * This example shows how to create an election with multiple candidates/options
 * and run through the complete voting process
 */

import { DecentralizedVotingSystem } from "../core/voting-system";
import { VoteOption, ElectionConfig } from "../core/types";

/**
 * Run a complete decentralized voting example with multiple vote options
 */
export async function runDecentralizedVotingExample(): Promise<void> {
  console.log("Starting Decentralized Voting System Example");
  console.log("================================================");

  // Create an election configuration with multiple options
  const electionConfig: ElectionConfig = {
    id: "presidential-election-2024",
    title: "Presidential Election 2024",
    description: "Choose your preferred candidate for president",
    options: [
      { id: "candidate-a", label: "Alice Johnson (Progressive)", value: 1 },
      { id: "candidate-b", label: "Bob Smith (Conservative)", value: 2 },
      { id: "candidate-c", label: "Carol Davis (Independent)", value: 3 },
      { id: "candidate-d", label: "David Wilson (Libertarian)", value: 4 },
    ],
    maxVotes: 1, // One vote per voter
    allowAbstain: false,
  };

  console.log("\nElection Configuration:");
  console.log(`Title: ${electionConfig.title}`);
  console.log(`Description: ${electionConfig.description}`);
  console.log("Options:");
  electionConfig.options.forEach((option) => {
    console.log(
      `  - ${option.label} (ID: ${option.id}, Value: ${option.value})`
    );
  });

  // Initialize the voting system
  const votingSystem = new DecentralizedVotingSystem(electionConfig);
  console.log("\nVoting system initialized");

  // Phase 1: Voter Registration
  console.log("\nPhase 1: Voter Registration");
  console.log("=================================");

  const voters = [
    "voter-001",
    "voter-002",
    "voter-003",
    "voter-004",
    "voter-005",
  ];
  const registrations = [];

  for (const voterId of voters) {
    try {
      const registration = await votingSystem.registerVoter(voterId);
      registrations.push(registration);
      console.log(`${voterId} registered successfully`);
    } catch (error) {
      console.log(`Failed to register ${voterId}: ${error}`);
    }
  }

  console.log(
    `\nRegistration Summary: ${registrations.length}/${voters.length} voters registered`
  );

  // Phase 2: Voting
  console.log("\nPhase 2: Voting");
  console.log("====================");

  const ballots = [];
  const voteChoices = [
    "candidate-a", // Alice
    "candidate-b", // Bob
    "candidate-c", // Carol
    "candidate-d", // David
    "candidate-a", // Alice again
  ];

  for (let i = 0; i < voters.length; i++) {
    const voterId = voters[i];
    const voteChoice = voteChoices[i];

    try {
      const ballot = await votingSystem.castBallot(voterId, voteChoice);
      ballots.push(ballot);

      const selectedOption = electionConfig.options.find(
        (opt) => opt.id === voteChoice
      );
      console.log(
        `${voterId} voted for: ${selectedOption?.label} (${voteChoice})`
      );
    } catch (error) {
      console.log(`${voterId} failed to vote: ${error}`);
    }
  }

  console.log(
    `\nVoting Summary: ${ballots.length}/${voters.length} ballots cast`
  );

  // Phase 3: Aggregation
  console.log("\nPhase 3: Aggregation");
  console.log("=========================");

  try {
    const aggregatedResults = await votingSystem.aggregate();
    console.log("Ballots aggregated successfully");
    console.log(
      `   Aggregate commitment: ${aggregatedResults.C_agg.toHex().slice(
        0,
        20
      )}...`
    );
    console.log(
      `   Aggregate anchor: ${aggregatedResults.H_S.toHex().slice(0, 20)}...`
    );
    console.log(
      `   Final result: ${aggregatedResults.X.toHex().slice(0, 20)}...`
    );
  } catch (error) {
    console.log(`Aggregation failed: ${error}`);
    return;
  }

  // Phase 4: Tally
  console.log("\nPhase 4: Tally");
  console.log("===================");

  try {
    const electionResult = await votingSystem.tally();
    console.log("Election tallied successfully");
    console.log(`\nFinal Results:`);
    console.log(`   Total Votes: ${electionResult.totalVotes}`);
    console.log("   Vote Distribution:");

    for (const option of electionConfig.options) {
      const voteCount = electionResult.optionResults[option.id];
      console.log(`     ${option.label}: ${voteCount} votes`);
    }
  } catch (error) {
    console.log(`Tally failed: ${error}`);
    return;
  }

  // Phase 5: Verification
  console.log("\nPhase 5: Verification");
  console.log("==========================");

  try {
    const electionResult = await votingSystem.tally();
    const isVerified = await votingSystem.verifyTally(
      electionResult.proof,
      electionResult.optionResults
    );

    if (isVerified) {
      console.log("Election results verified successfully!");
      console.log("   All commitments and anchors are consistent");
    } else {
      console.log("Election verification failed!");
      console.log("   Results may be inconsistent");
    }
  } catch (error) {
    console.log(`Verification failed: ${error}`);
  }

  // Additional system information
  console.log("\nSystem Information");
  console.log("======================");
  console.log(
    `Registered Voters: ${votingSystem.getRegisteredVoters().length}`
  );
  console.log(
    `Submitted Ballots: ${votingSystem.getSubmittedBallots().length}`
  );
  console.log(`Election ID: ${votingSystem.getElectionConfig().id}`);

  console.log("\nDecentralized voting example completed successfully!");
  console.log("=====================================================");
}

/**
 * Run a simple example with just 2 voters for quick testing
 */
export async function runSimpleVotingExample(): Promise<void> {
  console.log("Starting Simple Voting Example");
  console.log("==================================");

  // Create a simple election with 3 options
  const electionConfig: ElectionConfig = {
    id: "simple-poll",
    title: "Favorite Color Poll",
    description: "What's your favorite color?",
    options: [
      { id: "red", label: "Red", value: 1 },
      { id: "blue", label: "Blue", value: 2 },
      { id: "green", label: "Green", value: 3 },
    ],
  };

  const votingSystem = new DecentralizedVotingSystem(electionConfig);

  // Register 2 voters
  await votingSystem.registerVoter("alice");
  await votingSystem.registerVoter("bob");

  // Cast votes
  await votingSystem.castBallot("alice", "red");
  await votingSystem.castBallot("bob", "blue");

  // Tally results
  const result = await votingSystem.tally();
  console.log("Simple voting result:", result);

  console.log("Simple example completed!");
}

// Run the main example if this file is executed directly
if (require.main === module) {
  runDecentralizedVotingExample().catch(console.error);
}
