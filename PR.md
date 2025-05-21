# Add Beeper Connector Service for MetaState Integration

## Description

This PR adds a new service for extracting messages from the Beeper messaging platform and converting them to Resource Description Framework (RDF) format. This enables semantic integration with the MetaState ecosystem, particularly the eVault and Ontology Service, while providing visualization tools for analyzing communication patterns.

## Features

- Extract messages from the Beeper SQLite database
- Convert messages to RDF triples with semantic relationships compatible with MetaState ontology
- Generate visualization tools for data analysis:
  - Network graph showing connections between senders and rooms
  - Message activity timeline
  - Word cloud of common terms
  - Sender activity chart
- NPM scripts for easy integration with the monorepo structure

## Implementation

- New service under `services/beeper-connector/`
- Python-based implementation with clear CLI interface
- RDF output compatible with semantic web standards and MetaState ontology
- Comprehensive documentation for integration with other MetaState services

## Integration with MetaState Architecture

This connector enhances the MetaState ecosystem by:

1. **Data Ingestion**: Providing a way to import real-world messaging data into the MetaState eVault
2. **Semantic Representation**: Converting messages to RDF triples that can be processed by the Ontology Service
3. **Identity Integration**: Supporting connections with the W3ID system for identity verification
4. **Visualization**: Offering tools to analyze communication patterns and relationships

## How to Test

1. Install the required packages: `pip install -r services/beeper-connector/requirements.txt`
2. Run the extraction: `cd services/beeper-connector && python beeper_to_rdf.py --visualize`
3. Check the output RDF file (`beeper_messages.ttl`) and visualizations folder

## Future Enhancements

- Direct integration with eVault API for seamless data import
- Support for additional messaging platforms
- Enhanced ontology mapping for richer semantic relationships
- Real-time data synchronization

## Notes

- This tool respects user privacy by only accessing local database files
- RDF output follows standard Turtle format compatible with semantic web tools
- Visualizations require matplotlib, networkx, and wordcloud libraries 
