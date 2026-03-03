# w3ds-gateway

Resolve W3DS eNames to application URLs and present an app chooser.

## What it does

Given an **eName** (W3ID) and a **schemaId** (content type from the ontology), the gateway determines which platforms can handle that content and builds deep links into each one.

Think of it as Android's "Open with..." system, but for the W3DS ecosystem.

## Usage

### TypeScript / Node.js

```ts
import { resolveEName, SchemaIds } from "w3ds-gateway";

const result = await resolveEName(
    {
        ename: "@e4d909c2-5d2f-4a7d-9473-b34b6c0f1a5a",
        schemaId: SchemaIds.SocialMediaPost,
        entityId: "post-123",
    },
    {
        registryUrl: "https://registry.w3ds.metastate.foundation",
    },
);

for (const app of result.apps) {
    console.log(`${app.platformName}: ${app.url}`);
}
// Pictique: https://pictique.w3ds.metastate.foundation/home
// Blabsy: https://blabsy.w3ds.metastate.foundation/tweet/post-123
```

### Synchronous (no Registry call)

```ts
import { resolveENameSync, SchemaIds } from "w3ds-gateway";

const result = resolveENameSync({
    ename: "@user-uuid",
    schemaId: SchemaIds.File,
    entityId: "file-456",
});
// → File Manager, eSigner
```

### In Notification Messages

```ts
import { buildGatewayLink, SchemaIds } from "w3ds-gateway";

const link = buildGatewayLink({
    ename: "@user-uuid",
    schemaId: SchemaIds.SignatureContainer,
    entityId: "container-123",
    linkText: "Choose app to view document",
});
// → '<a href="w3ds-gateway://resolve?ename=..." class="w3ds-gateway-link" ...>Choose app to view document</a>'
```

## Embeddable Web Component

Drop `<w3ds-gateway-chooser>` into any platform — works in Svelte, React, or plain HTML:

```html
<script type="module">
    import "w3ds-gateway/modal";
</script>

<w3ds-gateway-chooser
    ename="@user-uuid"
    schema-id="550e8400-e29b-41d4-a716-446655440001"
    entity-id="post-123"
    registry-url="https://registry.w3ds.metastate.foundation"
></w3ds-gateway-chooser>

<script>
    document.querySelector("w3ds-gateway-chooser").open();
</script>
```

### JS API

| Method / Property | Description                         |
| ----------------- | ----------------------------------- |
| `el.open()`       | Open the chooser modal              |
| `el.close()`      | Close the chooser modal             |
| `el.isOpen`       | Whether the modal is currently open |

### Events

| Event            | Detail                 | Description                        |
| ---------------- | ---------------------- | ---------------------------------- |
| `gateway-open`   | —                      | Fired when the modal opens         |
| `gateway-close`  | —                      | Fired when the modal closes        |
| `gateway-select` | `{ platformKey, url }` | Fired when user clicks an app link |

## Supported Schemas

| Schema                 | Platforms                       |
| ---------------------- | ------------------------------- |
| User Profile           | Pictique, Blabsy                |
| Social Media Post      | Pictique, Blabsy                |
| Group / Chat           | Pictique, Blabsy, Group Charter |
| Message                | Pictique, Blabsy                |
| Voting Observation     | Cerberus, eReputation           |
| Ledger (Transaction)   | eCurrency                       |
| Currency               | eCurrency                       |
| Poll                   | eVoting, eReputation            |
| Vote                   | eVoting                         |
| Vote Reputation Result | eVoting, eReputation            |
| Wishlist               | DreamSync                       |
| Charter Signature      | Group Charter                   |
| Reference Signature    | eReputation                     |
| File                   | File Manager, eSigner           |
| Signature Container    | eSigner, File Manager           |

## Architecture

The gateway is **frontend-first** by design:

1. **Static capability map** — derived from the `.mapping.json` files across all platforms
2. **Optional Registry integration** — fetches live platform URLs from `GET /platforms`
3. **URL template system** — builds deep links using platform routes
4. **No dedicated backend required** — the resolver runs client-side or as a thin API endpoint
