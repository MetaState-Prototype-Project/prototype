# Beeper Connector v2.0 Upgrade Guide

## What's New in v2.0

The Beeper Connector has been completely upgraded with TypeScript implementation and full Web3 Adapter integration, enabling bidirectional synchronization with eVault.

### Major Features

1. **TypeScript Implementation**: Full type safety and modern development experience
2. **Web3 Adapter Integration**: Complete integration with MetaState's Web3 Adapter
3. **Bidirectional Sync**: Two-way synchronization between Beeper and eVault
4. **Real-time Updates**: Support for real-time message synchronization
5. **Cross-Platform Support**: Transform messages for Slack, Discord, Telegram
6. **Schema Mappings**: Proper ontology-based data transformation
7. **ACL Management**: Access control for private messages

## Migration from v1.0 (Python)

### Backward Compatibility

The original Python scripts are still available and functional:
- `beeper_to_rdf.py` - Extract messages to RDF
- `beeper_viz.py` - Generate visualizations

These can still be used via npm scripts:
```bash
npm run extract          # Python RDF extraction
npm run visualize        # Python visualization
npm run extract:visualize # Both
```

### New TypeScript Commands

```bash
npm run sync-to-evault    # Sync Beeper → eVault
npm run sync-from-evault  # Sync eVault → Beeper
npm run realtime          # Real-time bidirectional sync
npm run export-rdf        # TypeScript RDF export
```

## Architecture Changes

### v1.0 (Python)
```
Beeper DB → Python Script → RDF File → Manual Import
```

### v2.0 (TypeScript)
```
Beeper DB ←→ Beeper Connector ←→ Web3 Adapter ←→ eVault
                    ↓
                RDF Export
```

## Key Improvements

### 1. Bidirectional Sync
- Messages sync both ways between Beeper and eVault
- Changes in either system are reflected in the other
- Real-time updates with configurable intervals

### 2. Schema Mapping
- Proper ontology-based field mapping
- Support for multiple message schemas
- Cross-platform message transformation

### 3. ID Management
- W3ID to local ID mapping
- Persistent mapping storage
- Automatic ID resolution

### 4. Access Control
- ACL support for private messages
- Participant-based access control
- Proper permission management

## Configuration

### Environment Variables
```bash
export BEEPER_DB_PATH="~/Library/Application Support/BeeperTexts/index.db"
export ONTOLOGY_SERVER_URL="http://localhost:3000"
export EVAULT_URL="http://localhost:4000"
```

### Programmatic Configuration
```typescript
const connector = new BeeperConnector({
    dbPath: process.env.BEEPER_DB_PATH,
    ontologyServerUrl: process.env.ONTOLOGY_SERVER_URL,
    eVaultUrl: process.env.EVAULT_URL
});
```

## Database Schema

The connector creates additional tables for synchronization:

### w3_sync_mappings
```sql
CREATE TABLE w3_sync_mappings (
    local_id TEXT PRIMARY KEY,
    w3_id TEXT NOT NULL,
    last_synced_at DATETIME,
    sync_status TEXT
);
```

### synced_messages
```sql
CREATE TABLE synced_messages (
    id TEXT PRIMARY KEY,
    text TEXT,
    sender TEXT,
    senderName TEXT,
    room TEXT,
    roomName TEXT,
    timestamp DATETIME,
    w3_id TEXT,
    raw_data TEXT
);
```

## API Changes

### v1.0 Python API
```python
extract_messages_to_rdf(db_path, output_file, limit)
generate_visualizations(rdf_file, output_dir)
```

### v2.0 TypeScript API
```typescript
connector.initialize()
connector.syncToEVault(limit)
connector.syncFromEVault()
connector.enableRealtimeSync(intervalMs)
connector.exportToRDF(outputPath)
```

## Performance Improvements

- **Batch Processing**: Messages are processed in batches
- **Caching**: Ontology schemas are cached
- **Efficient Queries**: Optimized database queries
- **Concurrent Operations**: Parallel processing where possible

## Breaking Changes

None - v2.0 maintains full backward compatibility with v1.0 Python scripts.

## Deprecation Notice

While Python scripts remain functional, they will be deprecated in v3.0. We recommend migrating to the TypeScript implementation for:
- Better performance
- Type safety
- Real-time sync capabilities
- Full Web3 Adapter integration

## Support

For migration assistance or issues, please open an issue in the MetaState Prototype repository.