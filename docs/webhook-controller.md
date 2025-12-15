# Webhook Controller Guide

The webhook controller receives awareness protocol packets from the eVault system and saves them to your local database.

## What the Webhook Receives

The webhook endpoint (`POST /api/webhook`) receives awareness protocol packets with the following structure:

```json
{
  "id": "global-id-123",
  "schemaId": "uuid-of-schema",
  "w3id": "https://evault.example.com/users/123",
  "data": {
    "displayName": "John Doe",
    "username": "johndoe",
    // ... other fields according to the global schema
  }
}
```

The `schemaId` identifies which mapping to use for transforming the data, and `data` contains the entity information in the global ontology format.

## What to Do

1. **Find the mapping** using the `schemaId`:
```typescript
const mapping = Object.values(this.adapter.mapping).find(
    (m: any) => m.schemaId === schemaId
);
```

2. **Convert from global to local** using the adapter's `fromGlobal` method:
```typescript
const local = await this.adapter.fromGlobal({
    data: req.body.data,
    mapping,
});
```

This method uses your mapping configuration to transform the global ontology data into your local database schema format. See the [Mapping Rules documentation](../../infrastructure/web3-adapter/MAPPING_RULES.md) for details on creating mappings.

3. **Check if entity exists** using the global ID:
```typescript
let localId = await this.adapter.mappingDb.getLocalId(req.body.id);
```

4. **Save or update** the entity in your database:
   - If `localId` exists, update the existing entity
   - If not, create a new entity and store the mapping:
```typescript
await this.adapter.mappingDb.storeMapping({
    localId: entity.id,
    globalId: req.body.id,
});
```

5. **Return success**:
```typescript
res.status(200).send();
```

## Implementation Example

Here's a simplified example from `@eCurrency-api`:

```typescript
handleWebhook = async (req: Request, res: Response) => {
    const globalId = req.body.id;
    const schemaId = req.body.schemaId;
    
    try {
        // Find mapping
        const mapping = Object.values(this.adapter.mapping).find(
            (m: any) => m.schemaId === schemaId
        );
        
        if (!mapping) {
            throw new Error("No mapping found");
        }

        // Convert global to local
        const local = await this.adapter.fromGlobal({
            data: req.body.data,
            mapping,
        });

        // Check if exists
        let localId = await this.adapter.mappingDb.getLocalId(globalId);

        // Save or update based on entity type
        if (mapping.tableName === "users") {
            // Create or update user...
        } else if (mapping.tableName === "groups") {
            // Create or update group...
        }
        
        res.status(200).send();
    } catch (e) {
        console.error("Webhook error:", e);
        res.status(500).send();
    }
};
```

## Related Documentation

- **[Getting Started](./getting-started.md)** - Authentication and platform setup
- **[Mapping Rules](../../infrastructure/web3-adapter/MAPPING_RULES.md)** - How to create mappings between global and local schemas
