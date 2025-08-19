# Web3-Adapter Mapping Rules

This document explains how to create mappings for the web3-adapter system, which enables data exchange between different platforms using a universal ontology.

## Basic Structure

A mapping file defines how local database fields map to global ontology fields. The structure is:

```json
{
    "tableName": "local_table_name",
    "schemaId": "global_schema_uuid",
    "ownerEnamePath": "path_to_owner_ename",
    "ownedJunctionTables": ["junction_table1", "junction_table2"],
    "localToUniversalMap": {
        "localField": "globalField",
        "localRelation": "tableName(relationPath),globalAlias"
    }
}
```

## Field Mapping

### Direct Field Mapping

```json
"localField": "globalField"
```

Maps a local field directly to a global field with the same name.

### Relation Mapping

```json
"localRelation": "tableName(relationPath),globalAlias"
```

Maps a local relation to a global field, where:

- `tableName` is the referenced table name
- `relationPath` is the path to the relation data
- `globalAlias` is the target global field name

### Array Relation Mapping

```json
"participants": "users(participants[].id),participantIds"
```

Maps an array of relations:

- `participants[].id` extracts the `id` field from each item in the `participants` array
- `users()` resolves each ID to a global user reference
- `participantIds` is the target global field name

## Special Functions

### Date Conversion (`__date`)

Converts various timestamp formats to ISO string format.

```json
"createdAt": "__date(createdAt)"
"timestamp": "__date(calc(timestamp * 1000))"
```

**Supported input formats:**

- Unix timestamp (number)
- Firebase v8 timestamp (`{_seconds: number}`)
- Firebase v9+ timestamp (`{seconds: number}`)
- Firebase Timestamp objects
- Date objects
- UTC strings

### Calculation (`__calc`)

Performs mathematical calculations using field values.

```json
"total": "__calc(quantity * price)"
"average": "__calc((score1 + score2 + score3) / 3)"
```

**Features:**

- Supports basic arithmetic operations (+, -, \*, /, etc.)
- Can reference other fields in the same entity
- Automatically resolves field values before calculation

## Owner Path

The `ownerEnamePath` defines how to determine which eVault owns the data:

```json
"ownerEnamePath": "ename"                    // Direct field
"ownerEnamePath": "users(createdBy.ename)"   // Nested via relation
"ownerEnamePath": "users(participants[].ename)" // Array relation
```

## Junction Tables

Junction tables (many-to-many relationships) can be marked as owned:

```json
"ownedJunctionTables": [
    "user_followers",
    "user_following"
]
```

When junction table data changes, it triggers updates to the parent entity.

## Examples

### User Mapping

```json
{
    "tableName": "users",
    "schemaId": "550e8400-e29b-41d4-a716-446655440000",
    "ownerEnamePath": "ename",
    "ownedJunctionTables": ["user_followers", "user_following"],
    "localToUniversalMap": {
        "handle": "username",
        "name": "displayName",
        "description": "bio",
        "avatarUrl": "avatarUrl",
        "ename": "ename",
        "followers": "followers",
        "following": "following"
    }
}
```

### Group with Relations

```json
{
    "tableName": "groups",
    "schemaId": "550e8400-e29b-41d4-a716-446655440003",
    "ownerEnamePath": "users(participants[].ename)",
    "localToUniversalMap": {
        "name": "name",
        "description": "description",
        "owner": "owner",
        "admins": "users(admins),admins",
        "participants": "users(participants[].id),participantIds",
        "createdAt": "__date(createdAt)",
        "updatedAt": "__date(updatedAt)"
    }
}
```

## Best Practices

1. **Use descriptive global field names** that match the ontology schema
2. **Handle timestamps consistently** using `__date()` function
3. **Map relations properly** using the `tableName(relationPath)` syntax
4. **Use aliases** when the global field name differs from the local field
5. **Test mappings** with sample data to ensure proper conversion
6. **Document complex mappings** with comments explaining the logic

## Troubleshooting

### Common Issues

1. **Missing relations**: Ensure the referenced table has a mapping
2. **Invalid paths**: Check that the relation path matches your entity structure
3. **Type mismatches**: Use `__date()` for timestamps, `__calc()` for calculations
4. **Circular references**: Avoid mapping entities that reference each other infinitely

### Debug Tips

- Check the console for mapping errors
- Verify that all referenced tables have mappings
- Test with simple data first, then add complexity
- Use the `__calc()` function to debug field values
