# MetaState Infrastructure Components

## Overview

The infrastructure layer provides the core building blocks for the MetaState Prototype ecosystem, enabling decentralized identity, data storage, and cross-platform interoperability.

## Components

### 1. W3ID - Web3 Identity System
**Status:** In Progress

A decentralized identity management system that provides:
- Unique global identifiers (W3IDs)
- Identity verification and authentication
- Cross-platform identity resolution
- Integration with eVaults for secure data storage

[📖 Documentation](./w3id/README.md)

### 2. Web3 Adapter
**Status:** ✅ Complete

Enables seamless data exchange between different platforms through the W3DS infrastructure:
- Schema mapping between platform-specific and universal formats
- W3ID to local ID bidirectional mapping
- Access Control List (ACL) management
- MetaEnvelope creation and parsing
- Cross-platform data transformation

[📖 Documentation](./web3-adapter/README.md) | [📋 Schemas](./web3-adapter/docs/schemas.md)

### 3. eVault Core
**Status:** Planned

Personal data vaults that serve as the source of truth for user data:
- Envelope-based data storage
- Graph database structure
- W3ID integration
- Access control enforcement
- Web3 Protocol support

[📖 Documentation](./evault-core/README.md)

### 4. eVault Provisioner
**Status:** Planned

Manages the lifecycle of eVault instances:
- eVault creation and initialization
- Resource allocation
- Backup and recovery
- Multi-vault management

[📖 Documentation](./evault-provisioner/README.md)

### 5. eID Wallet
**Status:** In Progress

Digital wallet for managing electronic identities:
- Credential storage
- Identity verification
- Signature generation
- Integration with W3ID

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Applications Layer                     │
│          (Twitter, Instagram, Chat Platforms)              │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│                      Web3 Adapter                          │
│  • Schema Mapping  • ID Translation  • ACL Management      │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │   W3ID   │  │  eVault  │  │Provisioner│  │eID Wallet│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│                      Services Layer                        │
│         (Ontology Service, Registry, PKI, etc.)           │
└──────────────────────────────────────────────────────────┘
```

## Data Flow

### Writing Data (Platform → eVault)

1. **Platform generates data** (e.g., a tweet, post, message)
2. **Web3 Adapter converts** using schema mappings
3. **Data broken into Envelopes** with ontology references
4. **MetaEnvelope created** with W3ID and ACL
5. **Stored in user's eVault** as graph nodes

### Reading Data (eVault → Platform)

1. **Platform requests data** using W3ID or query
2. **eVault retrieves MetaEnvelope** with access control check
3. **Web3 Adapter converts** to platform-specific format
4. **ID mapping applied** (W3ID → local ID)
5. **Data delivered to platform** in native format

## Key Concepts

### Envelopes
Atomic units of data with:
- Unique identifier
- Ontology reference
- Value and type
- Access control

### MetaEnvelopes
Logical containers that group related envelopes:
- Represent complete entities (posts, profiles, etc.)
- Have unique W3IDs
- Include ACL for access control

### Schema Mappings
Define relationships between:
- Platform-specific fields
- Universal ontology fields
- Transformation functions

### W3IDs
Global unique identifiers that:
- Are platform-agnostic
- Enable cross-platform references
- Map to local platform IDs

## Development

### Prerequisites

- Node.js 20+ and pnpm
- TypeScript 5.0+
- Docker (for services)

### Setup

```bash
# Install dependencies
pnpm install

# Build all infrastructure components
pnpm build

# Run tests
pnpm test
```

### Testing Individual Components

```bash
# Test Web3 Adapter
cd infrastructure/web3-adapter
pnpm test

# Test W3ID
cd infrastructure/w3id
pnpm test
```

## Integration Points

### With Services

- **Ontology Service**: Schema definitions and validation
- **Registry**: Service discovery and metadata
- **PKI**: Certificate management and verification
- **Search**: Content indexing and discovery

### With Platforms

- **Social Media**: Twitter, Instagram, Facebook
- **Messaging**: Chat applications, forums
- **Content**: Blogs, media platforms
- **Enterprise**: Business applications

## Security Considerations

1. **Access Control**: All data protected by ACLs
2. **Identity Verification**: W3ID system ensures authenticity
3. **Data Encryption**: Sensitive data encrypted at rest
4. **Audit Logging**: All operations logged for compliance
5. **Privacy**: Users control their data through eVaults

## Roadmap

### Phase 1: Foundation (Current)
- ✅ Web3 Adapter implementation
- 🔄 W3ID system development
- 🔄 eID Wallet implementation

### Phase 2: Core Infrastructure
- [ ] eVault Core implementation
- [ ] eVault Provisioner
- [ ] Web3 Protocol integration

### Phase 3: Platform Integration
- [ ] Platform SDKs
- [ ] Migration tools
- [ ] Performance optimization

### Phase 4: Advanced Features
- [ ] AI-powered schema mapping
- [ ] Real-time synchronization
- [ ] Conflict resolution
- [ ] Advanced analytics

## Contributing

See the main [project README](../README.md) for contribution guidelines.

## Resources

- [MetaState Prototype Documentation](../README.md)
- [Web3 Adapter Documentation](./web3-adapter/README.md)
- [W3ID Documentation](./w3id/README.md)
- [Ontology Service](../services/ontology/README.md)