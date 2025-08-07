# MetaState Beeper Connector - Universal Messaging Bridge

This service provides a **universal connector** for ALL messaging platforms through Beeper's unified database, enabling seamless integration with the MetaState eVault. Since Beeper already aggregates messages from Slack, Telegram, WhatsApp, Facebook Messenger, Discord, Signal, and more through Matrix bridges, this single connector effectively provides access to all these platforms.

## Architecture Overview

```
┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   Slack     │────▶│          │     │          │     │          │
├─────────────┤     │          │     │  Beeper  │     │   Web3   │
│  Telegram   │────▶│  Beeper  │────▶│  SQLite  │────▶│ Adapter  │────▶ eVault
├─────────────┤     │  Matrix  │     │    DB    │     │          │
│  WhatsApp   │────▶│  Bridges │     │          │     │          │
├─────────────┤     │          │     │          │     │          │
│  Facebook   │────▶│          │     │          │     │          │
└─────────────┘     └──────────┘     └──────────┘     └──────────┘
     + 20 more platforms
```

The Beeper Connector leverages Beeper's existing infrastructure to:

- **Access 25+ messaging platforms** through a single integration
- Extract unified messages from Beeper's local SQLite database
- Transform messages to MetaEnvelopes for eVault storage
- Enable bidirectional synchronization with the MetaState ecosystem
- Generate semantic RDF triples and visualizations

## Features

- **Universal Platform Access**: Connect to 25+ messaging platforms via Beeper:
  - Slack, Microsoft Teams, Discord
  - Telegram, Signal, WhatsApp
  - Facebook Messenger, Instagram DMs
  - Twitter/X DMs, LinkedIn Messages
  - SMS, RCS, Google Chat, and more
- **Unified Data Model**: All messages normalized through Matrix protocol
- **Bidirectional Sync**: Two-way synchronization between platforms and eVault
- **Message Extraction**: Direct access to Beeper's unified SQLite database
- **RDF Conversion**: Transform messages into semantic RDF triples
- **Visualization Tools**:
  - Network graph showing relationships across ALL connected platforms
  - Unified message activity timeline
  - Cross-platform word cloud analysis
  - Multi-platform sender activity charts
- **Web3 Integration**: Full eVault synchronization with MetaEnvelope support

## Requirements

- Python 3.7 or higher
- Beeper app with a local database
- Required Python packages (see `requirements.txt`)

## Installation

1. Ensure you have Python 3.7+ installed
2. Install the required packages:

```bash
pip install -r requirements.txt
```

## Usage

### Basic Usage

```bash
python beeper_to_rdf.py
```

This will extract up to 10,000 messages from your Beeper database and save them as RDF triples in `beeper_messages.ttl`.

### Advanced Options

```bash
poetry run python beeper_to_rdf.py --output my_messages.ttl --limit 5000 --visualize
```

Command-line arguments:

- `--output`, `-o`: Output RDF file (default: `beeper_messages.ttl`)
- `--limit`, `-l`: Maximum number of messages to extract (default: 10000)
- `--db-path`, `-d`: Path to Beeper database file (default: `~/Library/Application Support/BeeperTexts/index.db`)
- `--visualize`, `-v`: Generate visualizations from the RDF data
- `--viz-dir`: Directory to store visualizations (default: `visualizations`)

### NPM Scripts

When used within the MetaState monorepo, you can use these npm scripts:

```bash
# Extract messages only
npm run extract

# Generate visualizations from existing RDF file
npm run visualize

# Extract messages and generate visualizations
npm run extract:visualize
```

## RDF Schema

The RDF data uses the following schema, which aligns with the MetaState ontology:

- Nodes:
  - `:Message` - Represents a message
  - `:Room` - Represents a chat room or conversation
  - `:Person` - Represents a message sender

- Properties:
  - `:hasRoom` - Links a message to its room
  - `:hasSender` - Links a message to its sender
  - `:hasContent` - Contains the message text
  - `dc:created` - Timestamp when message was sent

## Production Readiness Status

### ✅ Working Components (70% Complete)
- **Multi-platform Access**: Via Beeper's proven Matrix bridges
- **Data Extraction**: Reliable SQLite database reading
- **Schema Mapping**: Functional transformation to MetaEnvelopes
- **Bidirectional Sync**: Basic two-way synchronization implemented
- **RDF Export**: Production-ready semantic triple generation

### 🟡 In Progress (20%)
- **eVault Connection**: Currently using mock endpoints, needs real Web3 protocol
- **ID Persistence**: In-memory storage needs database backing
- **Error Recovery**: Basic error handling, needs retry logic and circuit breakers

### ⏳ Planned (10%)
- **Scale Testing**: Needs validation with millions of messages
- **Rate Limiting**: For production API compliance
- **Monitoring**: Observability and alerting integration

## Integration with MetaState

This service is designed to work with the broader MetaState ecosystem:

- Extract messages from Beeper as RDF triples
- Import data into eVault for semantic storage
- Use with the MetaState Ontology Service for enhanced metadata
- Connect with W3ID for identity management

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
