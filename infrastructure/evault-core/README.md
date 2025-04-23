# eVault Core

eVault is a secure, distributed data storage and access system designed for the MetaState ecosystem. It provides a robust framework for storing, managing, and accessing structured data with fine-grained access control and GraphQL-based querying capabilities.

## Overview

eVault is a core component of the MetaState infrastructure that enables:

- Secure storage of structured data
- Fine-grained access control using W3ID
- GraphQL-based data querying and manipulation
- Distributed data management
- Integration with the MetaState ecosystem

## Architecture

### Core Components

1. **GraphQL Server**

   - Provides a flexible API for data operations
   - Supports complex queries and mutations
   - Includes built-in documentation and visualization tools

2. **Access Control System**

   - W3ID-based authentication
   - Fine-grained access control lists (ACL)
   - Secure token-based authentication

3. **Data Storage**

   - Neo4j-based storage backend
   - Structured data model with envelopes
   - Support for multiple data types and ontologies

4. **HTTP Server**
   - Fastify-based web server
   - RESTful endpoints for basic operations
   - GraphQL endpoint for advanced operations

### Data Model

The eVault system uses a hierarchical data model:

- **MetaEnvelope**: Top-level container for related data

  - Contains multiple Envelopes
  - Has an associated ontology
  - Includes access control information

- **Envelope**: Individual data container
  - Contains structured data
  - Has a specific value type
  - Linked to a MetaEnvelope

## Features

### 1. Data Management

- Store and retrieve structured data
- Update and delete data with version control
- Search and filter data by ontology and content

### 2. Access Control

- W3ID-based authentication
- Fine-grained access control lists
- Secure token-based operations

### 3. Query Capabilities

- GraphQL-based querying
- Complex search operations
- Real-time data access

### 4. Integration

- Seamless integration with W3ID
- Support for multiple data formats
- Extensible architecture

## API Documentation

### GraphQL Operations

#### Queries

- `getMetaEnvelopeById`: Retrieve a specific MetaEnvelope
- `findMetaEnvelopesByOntology`: Find envelopes by ontology
- `searchMetaEnvelopes`: Search envelopes by content
- `getAllEnvelopes`: List all available envelopes

#### Mutations

- `storeMetaEnvelope`: Create a new MetaEnvelope
- `deleteMetaEnvelope`: Remove a MetaEnvelope
- `updateEnvelopeValue`: Update envelope content

### HTTP Endpoints

- `/graphql`: GraphQL API endpoint
- `/voyager`: GraphQL schema visualization
- `/documentation`: API documentation

## Getting Started

### Prerequisites

- Node.js
- Neo4j database
- W3ID system

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your_password
   PORT=4000
   ```
4. Start the server:
   ```bash
   npm start
   ```

## Security Considerations

- All operations require W3ID authentication
- Access control is enforced at both API and database levels
- Data is encrypted in transit and at rest
- Regular security audits and updates

## Integration Guide

### W3ID Integration

eVault uses W3ID for authentication and access control:

1. Obtain a W3ID token
2. Include token in Authorization header
3. Access eVault resources based on permissions

### Data Storage

1. Define data ontology
2. Create MetaEnvelope with appropriate ACL
3. Store and manage data through the API

## Development

### Testing

```bash
npm test
```

### Documentation

- API documentation available at `/documentation`
- GraphQL schema visualization at `/voyager`
- Example queries in `src/protocol/examples`

## Contributing

1. Fork the repository
2. Create feature branch
3. Submit pull request

## License

[License information]

## Support

[Support information]
