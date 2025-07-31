# MetaState Beeper Connector

This service extracts messages from a Beeper database and converts them to RDF (Resource Description Framework) format, allowing for semantic integration with the MetaState eVault and enabling visualization of messaging patterns.

## Overview

The Beeper Connector provides a bridge between the Beeper messaging platform and the MetaState ecosystem, enabling users to:

- Extract messages from their local Beeper database
- Convert messages to RDF triples with proper semantic relationships
- Generate visualizations of messaging patterns
- Integrate messaging data with other MetaState services

## Features

- **Message Extraction**: Access and extract messages from your local Beeper database
- **RDF Conversion**: Transform messages into semantic RDF triples
- **Visualization Tools**:
  - Network graph showing relationships between senders and chat rooms
  - Message activity timeline
  - Word cloud of most common terms
  - Sender activity chart
- **Integration with eVault**: Prepare data for import into MetaState eVault (planned)

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
python beeper_to_rdf.py --output my_messages.ttl --limit 5000 --visualize
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
