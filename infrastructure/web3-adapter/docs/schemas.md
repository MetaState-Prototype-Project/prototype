# Web3 Adapter Schema Documentation

## Overview

This document describes the schema mappings and data structures used by the Web3 Adapter to enable cross-platform data exchange through the MetaState infrastructure.

## Schema Mapping Structure

Each platform requires a schema mapping that defines how its local fields map to universal ontology fields.

### Schema Mapping Format

```typescript
interface SchemaMapping {
    tableName: string;           // Local database table name
    schemaId: string;            // UUID for ontology schema
    ownerEnamePath: string;      // Path to owner's ename
    ownedJunctionTables: string[]; // Related junction tables
    localToUniversalMap: Record<string, string>; // Field mappings
}
```

## Platform Schema Examples

### 1. Social Media Post Schema

**Universal Ontology: SocialMediaPost**

| Universal Field | Type | Description |
|-----------------|------|-------------|
| text | string | Main content of the post |
| userLikes | array | Users who liked/reacted |
| interactions | array | Comments, replies, responses |
| image | string | Media attachment URL |
| dateCreated | string | ISO timestamp of creation |

**Platform Mappings:**

#### Twitter
```json
{
    "post": "text",
    "reactions": "userLikes",
    "comments": "interactions",
    "media": "image",
    "createdAt": "dateCreated"
}
```

#### Instagram
```json
{
    "content": "text",
    "likes": "userLikes",
    "responses": "interactions",
    "attachment": "image",
    "postedAt": "dateCreated"
}
```

### 2. Chat Message Schema

**Universal Ontology: ChatMessage**

| Universal Field | Type | Description |
|-----------------|------|-------------|
| name | string | Chat/room name |
| type | string | Chat type (private, group, public) |
| participantIds | array | Participant user IDs |
| createdAt | string | Creation timestamp |
| updatedAt | string | Last update timestamp |

**Platform Mapping:**

```json
{
    "chatName": "name",
    "type": "type",
    "participants": "users(participants[].id),participantIds",
    "createdAt": "createdAt",
    "updatedAt": "updatedAt"
}
```

## Envelope Structure

Data is broken down into atomic envelopes for storage in eVault:

```typescript
interface Envelope {
    id: string;        // Unique envelope ID
    ontology: string;  // Ontology field reference
    value: any;        // Actual data value
    valueType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'blob';
}
```

### Example Envelope

```json
{
    "id": "dc074604-b394-5e9f-b574-38ef4dbf1d66",
    "ontology": "text",
    "value": "Hello, Web3 world!",
    "valueType": "string"
}
```

## MetaEnvelope Structure

MetaEnvelopes group related envelopes as logical entities:

```typescript
interface MetaEnvelope {
    id: string;           // Unique MetaEnvelope ID (W3ID)
    ontology: string;     // Schema name (e.g., "SocialMediaPost")
    acl: string[];        // Access control list
    envelopes: Envelope[]; // Related envelopes
}
```

### Example MetaEnvelope

```json
{
    "id": "0e77202f-0b44-5b9b-b281-27396edf7dc5",
    "ontology": "SocialMediaPost",
    "acl": ["*"],
    "envelopes": [
        {
            "id": "env-1",
            "ontology": "text",
            "value": "Cross-platform post",
            "valueType": "string"
        },
        {
            "id": "env-2",
            "ontology": "userLikes",
            "value": ["user1", "user2"],
            "valueType": "array"
        }
    ]
}
```

## Access Control Lists (ACL)

ACLs control data access across platforms:

### ACL Fields in Platform Data

```typescript
interface PlatformData {
    // ... other fields
    _acl_read?: string[];  // Users who can read
    _acl_write?: string[]; // Users who can write
}
```

### ACL Rules

1. **Public Access**: ACL contains `["*"]`
2. **Private Access**: ACL contains specific user IDs
3. **No ACL**: Defaults to public access `["*"]`

### Example with ACL

```json
{
    "id": "private-post-123",
    "post": "Private content",
    "_acl_read": ["friend1", "friend2", "friend3"],
    "_acl_write": ["author-id"]
}
```

## ID Mapping

The adapter maintains mappings between W3IDs and local platform IDs:

```typescript
interface IdMapping {
    w3Id: string;        // Global W3ID
    localId: string;     // Platform-specific ID
    platform: string;    // Platform name
    resourceType: string; // Resource type (posts, chats, etc.)
    createdAt: Date;
    updatedAt: Date;
}
```

### ID Mapping Example

```json
{
    "w3Id": "0e77202f-0b44-5b9b-b281-27396edf7dc5",
    "localId": "tweet-123456",
    "platform": "twitter",
    "resourceType": "posts",
    "createdAt": "2025-05-02T10:30:00Z",
    "updatedAt": "2025-05-02T10:30:00Z"
}
```

## Data Flow

### Writing to eVault

1. **Platform Data** → 
2. **Schema Mapping** → 
3. **Universal Format** → 
4. **Envelopes** → 
5. **MetaEnvelope** → 
6. **eVault Storage**

### Reading from eVault

1. **eVault Query** → 
2. **MetaEnvelope** → 
3. **Extract Envelopes** → 
4. **Schema Mapping** → 
5. **Platform Format** → 
6. **Local Storage**

## Platform-Specific Transformations

### Twitter Transformation

```typescript
twitter: (data) => ({
    post: data.text,
    reactions: data.userLikes,
    comments: data.interactions,
    media: data.image
})
```

### Instagram Transformation

```typescript
instagram: (data) => ({
    content: data.text,
    likes: data.userLikes,
    responses: data.interactions,
    attachment: data.image
})
```

## Value Type Mappings

| Platform Type | Universal Type | Envelope ValueType |
|---------------|----------------|-------------------|
| String | string | "string" |
| Number | number | "number" |
| Boolean | boolean | "boolean" |
| Array | array | "array" |
| Object/JSON | object | "object" |
| Binary/File | blob | "blob" |

## Configuration

### Adapter Configuration

```typescript
interface AdapterConfig {
    platform: string;           // Platform identifier
    ontologyServerUrl: string;  // Ontology service URL
    eVaultUrl: string;         // eVault service URL
    enableCaching?: boolean;   // Enable schema caching
}
```

### Example Configuration

```typescript
const config: AdapterConfig = {
    platform: 'twitter',
    ontologyServerUrl: 'http://ontology.metastate.local',
    eVaultUrl: 'http://evault.metastate.local',
    enableCaching: true
};
```

## Best Practices

1. **Schema Design**
   - Keep universal schemas generic and extensible
   - Use clear, descriptive field names
   - Document all transformations

2. **ID Management**
   - Always maintain bidirectional mappings
   - Store mappings persistently
   - Handle ID conflicts gracefully

3. **ACL Handling**
   - Default to least privilege
   - Validate ACL entries
   - Log ACL changes for audit

4. **Performance**
   - Cache ontology schemas
   - Batch operations when possible
   - Optimize envelope creation

5. **Error Handling**
   - Validate data before transformation
   - Handle missing fields gracefully
   - Log transformation errors

## Extending the Adapter

To add support for a new platform:

1. Define the schema mapping
2. Add platform-specific transformations
3. Update test cases
4. Document the new mappings

### Example: Adding Facebook Support

```typescript
// 1. Add schema mapping
const facebookMapping: SchemaMapping = {
    tableName: "fb_posts",
    schemaId: "550e8400-e29b-41d4-a716-446655440005",
    ownerEnamePath: "user(author.ename)",
    ownedJunctionTables: [],
    localToUniversalMap: {
        "status": "text",
        "likes": "userLikes",
        "comments": "interactions",
        "photo": "image",
        "timestamp": "dateCreated"
    }
};

// 2. Add transformation
facebook: (data) => ({
    status: data.text,
    likes: data.userLikes,
    comments: data.interactions,
    photo: data.image,
    timestamp: new Date(data.dateCreated).getTime()
})
```

## Troubleshooting

### Common Issues

1. **Missing Schema Mapping**
   - Error: "No schema mapping found for table: X"
   - Solution: Add mapping in loadSchemaMappings()

2. **ID Not Found**
   - Error: "Cannot find local ID for W3ID: X"
   - Solution: Check ID mapping storage

3. **Invalid Value Type**
   - Error: "Unknown value type: X"
   - Solution: Add type detection in detectValueType()

4. **ACL Validation Failed**
   - Error: "Invalid ACL entry: X"
   - Solution: Validate user IDs exist

## References

- [MetaState Prototype Documentation](../../README.md)
- [W3ID System](../w3id/README.md)
- [eVault Core](../evault-core/README.md)
- [Ontology Service](../../services/ontology/README.md)