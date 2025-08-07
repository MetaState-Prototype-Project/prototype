# Web3 Adapter Implementation for MetaState Prototype

## PR #138 - Complete Web3 Adapter Implementation

### Description

This PR completes the implementation of the Web3 Adapter, a critical infrastructure component that enables seamless data exchange between different social media platforms through the W3DS (Web3 Data System) infrastructure. The adapter acts as a bridge between platform-specific data models and the universal ontology-based storage in eVaults.

### Implementation Overview

The Web3 Adapter provides two-way synchronization between platforms and eVaults while allowing platforms to remain "unaware" of the W3DS complexity. It handles all the necessary transformations, ID mappings, and access control management.

### Features Implemented

#### 1. Schema Mapping System
- Maps platform-specific fields to universal ontology schemas
- Supports complex field transformations
- Configurable mappings for different platforms
- Example mappings for Twitter, Instagram, and chat platforms

#### 2. W3ID to Local ID Mapping
- Bidirectional mapping between W3IDs and platform-specific identifiers
- Persistent mapping storage (in-memory for now, with hooks for database integration)
- Automatic ID translation during data conversion

#### 3. ACL (Access Control List) Management
- Extracts ACL from platform data (`_acl_read`, `_acl_write` fields)
- Applies ACL to MetaEnvelopes for controlled access
- Restores ACL fields when converting back to platform format
- Default public access (`*`) when no ACL specified

#### 4. MetaEnvelope Support
- Converts platform data to atomic Envelopes with ontology references
- Groups related envelopes in MetaEnvelopes
- Supports all value types: string, number, boolean, array, object, blob
- Automatic value type detection and conversion

#### 5. Cross-Platform Data Exchange
- Transform data between different platform formats
- Platform-specific transformations (Twitter, Instagram, etc.)
- Maintains data integrity across platforms
- Example: Twitter "post" → Universal "text" → Instagram "content"

#### 6. Batch Operations
- Synchronize multiple records efficiently
- Bulk data conversion support
- Optimized for large-scale data migrations

### Technical Architecture

```typescript
// Core Types
- SchemaMapping: Platform to universal field mappings
- Envelope: Atomic data units with ontology references
- MetaEnvelope: Container for related envelopes
- IdMapping: W3ID to local ID relationships
- ACL: Access control permissions
- PlatformData: Platform-specific data structures

// Main Class Methods
- toEVault(): Convert platform data to MetaEnvelope
- fromEVault(): Convert MetaEnvelope to platform data
- handleCrossPlatformData(): Transform between platforms
- syncWithEVault(): Batch synchronization
```

### File Structure

```
infrastructure/web3-adapter/
├── src/
│   ├── adapter.ts        # Main adapter implementation
│   ├── types.ts          # TypeScript type definitions
│   ├── index.ts          # Module exports
│   └── __tests__/
│       └── adapter.test.ts # Comprehensive test suite
├── examples/
│   └── usage.ts          # Usage examples
├── README.md             # Complete documentation
├── package.json          # Package configuration
└── tsconfig.json         # TypeScript configuration
```

### Testing

All tests passing (11 tests):
- ✅ Schema mapping (platform to eVault and back)
- ✅ ID mapping (W3ID to local ID conversion)
- ✅ ACL handling (extraction and application)
- ✅ Cross-platform data transformation
- ✅ Value type detection
- ✅ Batch synchronization

### Usage Example

```typescript
// Initialize adapter for Twitter
const adapter = new Web3Adapter({
    platform: 'twitter',
    ontologyServerUrl: 'http://ontology-server.local',
    eVaultUrl: 'http://evault.local'
});

// Convert Twitter post to eVault format
const twitterPost = {
    id: 'tweet-123',
    post: 'Hello Web3!',
    reactions: ['user1', 'user2'],
    _acl_read: ['public'],
    _acl_write: ['author']
};

const eVaultPayload = await adapter.toEVault('posts', twitterPost);

// Platform B reads the same data in their format
const instagramData = await adapter.handleCrossPlatformData(
    eVaultPayload.metaEnvelope,
    'instagram'
);
// Result: { content: 'Hello Web3!', likes: [...] }
```

### Integration Points

1. **Ontology Server**: Fetches schema definitions
2. **eVault**: Stores/retrieves MetaEnvelopes
3. **W3ID System**: Identity resolution
4. **Platforms**: Twitter, Instagram, chat applications

### Future Enhancements

- [ ] Persistent ID mapping storage (database integration)
- [ ] Real ontology server integration
- [ ] Web3 Protocol implementation for eVault communication
- [ ] AI-powered schema mapping suggestions
- [ ] Performance optimizations for large datasets
- [ ] Event-driven synchronization
- [ ] Conflict resolution strategies

### Breaking Changes

None - This is a new implementation.

### Dependencies

- TypeScript 5.0+
- Vitest for testing
- No external runtime dependencies (self-contained)

### How to Test

```bash
# Install dependencies
pnpm install

# Run tests
cd infrastructure/web3-adapter
pnpm test

# Run usage example
npx tsx examples/usage.ts
```

### Documentation

- [Web3 Adapter README](./README.md)
- [Usage Examples](./examples/usage.ts)
- [API Documentation](./src/types.ts)
- [Test Cases](./src/__tests__/adapter.test.ts)

### Review Checklist

- [x] Code follows project conventions
- [x] All tests passing
- [x] Documentation complete
- [x] Examples provided
- [x] Type definitions exported
- [x] No breaking changes
- [x] Ready for integration

### Related Issues

- Implements requirements from MetaState Prototype documentation
- Enables platform interoperability as specified in the architecture

### Contributors

- Implementation based on MetaState Prototype specifications
- Documentation by Merul (02-May-2025)