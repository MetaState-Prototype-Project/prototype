# BlindVote - Decentralized Privacy-Preserving Voting System

A cryptographically secure voting system that uses Pedersen commitments to ensure voter privacy while maintaining public verifiability of election results.

## Key Features

- **Totally Decentralized**: No trusted servers or dealers needed
- **Flexible Voting Options**: Support for any number of vote options (not just binary yes/no)
- **Privacy Preserving**: Individual votes are never revealed
- **Publicly Verifiable**: Anyone can verify the final election results
- **Cryptographically Sound**: Uses ed25519 elliptic curve and proper Pedersen commitments
- **Simple & Clean**: No complex ZK proofs - just the essential crypto operations

## Architecture

The system follows a simple 5-phase process:

1. **Registration**: Voters create public randomness anchors
2. **Voting**: Voters submit encrypted ballots using Pedersen commitments
3. **Aggregation**: All commitments are homomorphically combined
4. **Tally**: Final results are computed from the aggregate commitment
5. **Verification**: Anyone can verify the results are consistent

## Cryptographic Foundation

### Pedersen Commitments

- **Commitment**: `C(m, r) = g^m * h^r`
  - `g` = generator point
  - `h` = second generator (unknown discrete log relationship)
  - `m` = vote value
  - `r` = random blinding factor

### Homomorphic Properties

- **Addition**: `C(m1, r1) * C(m2, r2) = C(m1 + m2, r1 + r2)`
- **Aggregation**: `C_agg = ∏ C_i = g^(∑m_i) * h^(∑r_i)`
- **Cancellation**: `X = C_agg * H_S^(-1) = g^(∑m_i)`

## Project Structure

```
src/
├── core/
│   ├── types.ts          # Type definitions
│   └── voting-system.ts  # Main voting system implementation
├── crypto/
│   └── pedersen.ts       # Pedersen commitment implementation
└── examples/
    └── example.ts        # Presidential election example
```

## Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd blindvote

# Install dependencies
pnpm install

# Build the project
pnpm build
```

### Basic Usage

```typescript
import { DecentralizedVotingSystem, ElectionConfig } from "blindvote";

// Create an election configuration
const electionConfig: ElectionConfig = {
  id: "demo-election",
  title: "Demo Election",
  description: "A simple demonstration",
  options: [
    { id: "option-a", label: "Option A", value: 1 },
    { id: "option-b", label: "Option B", value: 2 },
    { id: "option-c", label: "Option C", value: 3 },
  ],
};

// Initialize the voting system
const votingSystem = new DecentralizedVotingSystem(electionConfig);

// Register voters
await votingSystem.registerVoter("alice");
await votingSystem.registerVoter("bob");

// Cast votes
await votingSystem.castBallot("alice", "option-a");
await votingSystem.castBallot("bob", "option-b");

// Aggregate and tally
const result = await votingSystem.tally();
console.log("Election result:", result);
```

### Running Examples

```bash
# Presidential election example
node dist/examples/example.js
```

## API Reference

### ElectionConfig

```typescript
interface ElectionConfig {
  id: string; // Unique election identifier
  title: string; // Human-readable title
  description?: string; // Optional description
  options: VoteOption[]; // Available vote options
  maxVotes?: number; // Maximum votes per voter (default: 1)
  allowAbstain?: boolean; // Allow abstaining (default: false)
}
```

### VoteOption

```typescript
interface VoteOption {
  id: string; // Unique option identifier
  label: string; // Human-readable label
  value: number; // Numeric value for the option
}
```

### DecentralizedVotingSystem

#### Core Methods

- `registerVoter(voterId: string): Promise<Anchor>` - Register a new voter
- `castBallot(voterId: string, optionId: string): Promise<Ballot>` - Cast a vote
- `aggregate(): Promise<AggregatedResults>` - Aggregate all ballots
- `tally(): Promise<ElectionResult>` - Compute final results
- `verifyTally(results, expected): Promise<boolean>` - Verify results

#### Utility Methods

- `getRegisteredVoters(): Anchor[]` - Get all registered voters
- `getSubmittedBallots(): Ballot[]` - Get all submitted ballots
- `isVoterRegistered(voterId): boolean` - Check voter registration
- `hasVoterVoted(voterId): boolean` - Check if voter has voted

## Use Cases

### Multi-Candidate Elections

- Presidential elections
- Board member elections
- Award voting

### Preference Voting

- Ranked choice voting
- Approval voting
- Score voting

### Surveys and Polls

- Customer satisfaction surveys
- Product preference polls
- Team decision making

## Security Properties

1. **Vote Privacy**: Individual votes are never revealed
2. **Vote Integrity**: Votes cannot be modified after submission
3. **Voter Anonymity**: Voter identity is not linked to their vote
4. **Public Verifiability**: Anyone can verify the final results
5. **No Double Voting**: Each voter can only vote once
6. **Decentralized**: No single point of failure or control

## Limitations & Considerations

### Current Implementation

- **Demo Tallying**: The current tally implementation simulates vote counting for demonstration
- **No ZK Proofs**: Simplified version without zero-knowledge proofs
- **Basic Validation**: Simple validation without advanced cryptographic proofs

### Production Considerations

- **Discrete Log Problem**: For large vote counts, discrete log computation becomes expensive
- **Multi-Option Tallying**: Current scheme works best for binary or small-range voting
- **Voter Authentication**: This implementation doesn't handle real-world voter authentication
- **Network Layer**: No built-in networking or bulletin board implementation

## Future Enhancements

1. **Efficient Multi-Option Tallying**: Implement proper schemes for multi-option voting
2. **Voter Authentication**: Add real-world voter identity verification
3. **Network Layer**: Implement decentralized bulletin board
4. **Advanced Privacy**: Add mix networks or other privacy enhancements
5. **Scalability**: Optimize for large-scale elections

## Testing

```bash
# Build the project
pnpm build

# Run examples
node dist/examples/example.js

# Run tests (if available)
pnpm test
```

## Technical Details

### Curve Choice: ed25519

- **Performance**: Faster than secp256k1 for most operations
- **Security**: 128-bit security level
- **Standardization**: Well-established and audited
- **Implementation**: Uses @noble/curves library

### Commitment Scheme

- **Binding**: Computationally infeasible to find different messages with same commitment
- **Hiding**: Commitment reveals no information about the message
- **Homomorphic**: Commitments can be combined algebraically

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This is a research and educational implementation. For production use, additional security audits, testing, and hardening would be required.

## References

- [Pedersen Commitments](https://en.wikipedia.org/wiki/Commitment_scheme#Pedersen_commitment)
- [ed25519 Curve](https://ed25519.cr.yp.to/)
- [Homomorphic Encryption](https://en.wikipedia.org/wiki/Homomorphic_encryption)
- [Decentralized Voting](https://en.wikipedia.org/wiki/Electronic_voting#Decentralized_voting)

---

Built with love for transparent, secure, and democratic voting systems.
