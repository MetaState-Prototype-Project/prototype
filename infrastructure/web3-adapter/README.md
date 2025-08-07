# Web3 Adapter

The Web3 Adapter is a critical component of the MetaState Prototype that enables seamless data exchange between different social media platforms through the W3DS (Web3 Data System) infrastructure.

## Features

### ✅ Complete Implementation

1. **Schema Mapping**: Maps platform-specific data models to universal ontology schemas
2. **W3ID to Local ID Mapping**: Maintains bidirectional mapping between W3IDs and platform-specific identifiers
3. **ACL Handling**: Manages access control lists for read/write permissions
4. **MetaEnvelope Support**: Converts data to/from eVault's envelope-based storage format
5. **Cross-Platform Data Exchange**: Enables data sharing between different platforms (Twitter, Instagram, etc.)
6. **Batch Synchronization**: Supports bulk data operations for efficiency
7. **Ontology Integration**: Interfaces with ontology servers for schema validation

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│  Platform   │────▶│ Web3 Adapter │────▶│   eVault   │
│  (Twitter)  │◀────│              │◀────│            │
└─────────────┘     └──────────────┘     └────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   Ontology   │
                    │    Server    │
                    └──────────────┘
```

## Core Components

### Types (`src/types.ts`)
- `SchemaMapping`: Defines platform-to-universal field mappings
- `Envelope`: Individual data units with ontology references
- `MetaEnvelope`: Container for related envelopes
- `IdMapping`: W3ID to local ID relationships
- `ACL`: Access control permissions
- `PlatformData`: Platform-specific data structures

### Adapter (`src/adapter.ts`)
The main `Web3Adapter` class provides:
- `toEVault()`: Converts platform data to MetaEnvelope format
- `fromEVault()`: Converts MetaEnvelope back to platform format
- `handleCrossPlatformData()`: Transforms data between different platforms
- `syncWithEVault()`: Batch synchronization functionality

## Usage

```typescript
import { Web3Adapter } from 'web3-adapter';

// Initialize adapter for a specific platform
const adapter = new Web3Adapter({
    platform: 'twitter',
    ontologyServerUrl: 'http://ontology-server.local',
    eVaultUrl: 'http://evault.local'
});

await adapter.initialize();

// Convert platform data to eVault format
const twitterPost = {
    id: 'tweet-123',
    post: 'Hello Web3!',
    reactions: ['user1', 'user2'],
    comments: ['Nice post!'],
    _acl_read: ['user1', 'user2', 'public'],
    _acl_write: ['author']
};

const eVaultPayload = await adapter.toEVault('posts', twitterPost);

// Convert eVault data back to platform format
const platformData = await adapter.fromEVault(eVaultPayload.metaEnvelope, 'posts');
```

## Cross-Platform Data Exchange

The adapter enables seamless data exchange between platforms:

```typescript
// Platform A (Twitter) writes data
const twitterAdapter = new Web3Adapter({ platform: 'twitter', ... });
const twitterData = { post: 'Hello!', reactions: [...] };
const metaEnvelope = await twitterAdapter.toEVault('posts', twitterData);

// Platform B (Instagram) reads the same data
const instagramAdapter = new Web3Adapter({ platform: 'instagram', ... });
const instagramData = await instagramAdapter.handleCrossPlatformData(
    metaEnvelope.metaEnvelope,
    'instagram'
);
// Result: { content: 'Hello!', likes: [...] }
```

## Schema Mapping Configuration

Schema mappings define how platform fields map to universal ontology:

```json
{
    "tableName": "posts",
    "schemaId": "550e8400-e29b-41d4-a716-446655440004",
    "ownerEnamePath": "user(author.ename)",
    "localToUniversalMap": {
        "post": "text",
        "reactions": "userLikes",
        "comments": "interactions",
        "media": "image",
        "createdAt": "dateCreated"
    }
}
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch
```

## Implementation Status

- ✅ Schema mapping with ontology support
- ✅ W3ID to local ID bidirectional mapping
- ✅ ACL extraction and application
- ✅ MetaEnvelope creation and parsing
- ✅ Cross-platform data transformation
- ✅ Batch synchronization support
- ✅ Value type detection and conversion
- ✅ Comprehensive test coverage

## Future Enhancements

- [ ] Persistent ID mapping storage (currently in-memory)
- [ ] Real ontology server integration
- [ ] Web3 Protocol implementation for eVault communication
- [ ] AI-powered schema mapping suggestions
- [ ] Performance optimizations for large datasets
- [ ] Event-driven synchronization
- [ ] Conflict resolution strategies

## Contributing

See the main project README for contribution guidelines.

## License

Part of the MetaState Prototype Project