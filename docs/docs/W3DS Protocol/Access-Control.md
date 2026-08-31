---
sidebar_position: 7
---

# Access Control

An eVault record carries its own access rules. They say which parties may read it, add to it, change it, or delete it — and, separately, what a platform must *be* before it may read at all.

The rules live inside the record, not in a table beside it. Data syncs between platforms, and a central rules table would not follow it; the protection would be lost the moment the data moved. Keeping the policy in the record keeps it attached.

## Why the second half exists

Naming every acceptable platform by hand does not scale, and it misses what an owner actually wants to say: *any platform may read this, provided it is reputable enough*. So a policy has two halves. Grants and denials name parties. The **Resource Link Ontology** sets quality conditions that admit a platform that was never named individually — and refuse one that was.

## Parties

Every party is an eName, `@<uuid>`. The same form identifies a user, a platform, or a group; a group stands for the set of its members and is resolved to them at check time. Ontologies are parties too and carry their own eName.

```
@7b9c2e1a-4f30-4c5e-9a21-d8e0f1a2b3c4   a user
@2d4f6a8b-1c3e-4d5f-8a9b-0c1d2e3f4a5b   a platform
@9f0e1d2c-3b4a-5968-7766-554433221100   a group
@1a1a1a1a-0000-0000-0000-000000000001   an ontology (eReputation)
```

## Permissions

Four permissions, held as a bitmask in a single unsigned byte. Bits are independent and combine by union.

| Bit | Value | Permission | Meaning |
|---|---|---|---|
| 0 | `0x01` | READ | May view the data. |
| 1 | `0x02` | CREATE | May add new records. |
| 2 | `0x04` | UPDATE | May change existing content. |
| 3 | `0x08` | DELETE | May remove the data. |
| 4–7 | — | reserved | Must be `0`. |

`0x0F` is full access. `0x01` is read-only. `0x03` is read plus **add-only** — a party that may add new records but not change existing ones. `0x00` is meaningless and counts as no grant at all.

A write that sets a reserved bit is rejected rather than quietly narrowed, so a client built against a later version of this spec fails loudly instead of silently receiving weaker permissions than it asked for.

## Grants

A record carries a list of grants, each naming one party and the permissions it holds.

Where several grants could apply to the same request, **the most specific one wins**: a grant to a user beats one to a platform, which beats one to a group the party belongs to. Only that grant is used. Less specific grants do not add to it.

```
grants: [
  { ename: @9f0e…1100, perms: 0x05 },   // a group: READ + UPDATE
  { ename: @7b9c…b3c4, perms: 0x01 }    // a member of it: READ
]
```

That member has **READ only**. The direct grant is more specific, so the group's UPDATE is never consulted for them.

Grants tied at the same specificity — duplicates, or two groups the party belongs to — are unioned. Nothing orders one above the other, and picking arbitrarily would make the outcome depend on storage order.

A direct grant is final. A named party never falls through to the ontology half, whether its grant allowed the action or not.

## Denials

A denial removes access regardless of any grant. **Deny always wins**, with no exceptions — it is the one place where specificity does not decide the outcome.

A denial names a party, or states a condition. A denial by name matches the party itself, the platform carrying its request, or any group it belongs to. A denial by condition applies to anyone who **fails** the check.

```
grants:         [ { ename: @2d4f…4a5b, perms: 0x01 } ]
denials.enames: [ @2d4f…4a5b ]
```

Refused. The denial overrides the grant.

## Conditions

An ontology is a structured description of some quality, published as a JSON Schema, referenced by its eName. To use one, point a JSONPath into it and attach a numeric requirement to the value found there.

```
{ ontology: @1a1a1a1a-…-0001, path: "$.score", op: ">=", value: 60 }
```

Operators are numeric only: `>=`, `>`, `<=`, `<`, `==`. The score is held on the eVault of the platform that is its subject.

A path that is missing, resolves to several nodes, or resolves to a non-numeric value is a **failed** condition — never a passing one. A condition never fails open.

## Combining conditions

Conditions are organised into groups. Within a group all conditions must pass; across groups any one group passing is enough. It is an OR of ANDs.

```
require: [
  [ { @sec, $.score, >=, 80 }, { @erep, $.score, >=, 60 } ],   // Group A
  [ { @erep, $.score, >=, 90 } ]                               // Group B
]
```

A platform is admitted if it clears security *and* reputation together, or clears a higher reputation bar on its own. Groups are evaluated in order and the first passing group decides.

An empty group is an AND over zero conditions, so it always passes — that is how a policy says "admit anyone, subject to the denials".

## How a decision is reached

For a party **P** requesting action **A** on record **R**:

1. **Denials.** If any denial applies — by eName, or by a failing deny condition — refuse. Nothing below overrides this.
2. **A direct grant.** If P is named, take the single most specific applicable grant and allow only if its bitmask includes A. A grant decides the outcome on its own; step 3 is not reached.
3. **The ontology.** If at least one group in `require` passes for P, allow if `default_perms` includes A. Otherwise refuse.

```
grants:         { @platform-2d4f: 0x01 }
denials.enames: [ @platform-bad1 ]
default_perms:  0x01
require: [ [ {@sec,$.score,>=,80}, {@erep,$.score,>=,60} ],
           [ {@erep,$.score,>=,90} ] ]

@platform-bad1 asks READ    -> refused at step 1.
@platform-2d4f asks READ    -> allowed at step 2 (0x01 includes READ).
@platform-2d4f asks DELETE  -> refused (0x01 lacks DELETE); step 3 not reached.
unnamed, sec 84 + erep 72   -> Group A passes; READ allowed at step 3.
unnamed, erep 95, no sec    -> Group A fails on the missing score, Group B passes.
```

## Who the requesting party is

A request reaches the eVault carrying a platform's token. That token proves the platform. It does not say which of the platform's users the request is for, and many requests are made on a user's behalf.

The `X-ON-BEHALF-OF` header carries that: an eName the platform declares it is acting for.

```
Authorization: Bearer <platform token>
X-ENAME: @<vault owner>
X-ON-BEHALF-OF: @<user the platform is acting for>
```

When present, that user is the party, and the platform carrying the request is recorded alongside it — so a grant to the user applies at user specificity, and a grant to the platform still applies at platform specificity. When absent, the platform itself is the party.

**This is an assertion, not a proof.** The platform's token does not attest to the user, so the claim is exactly as trustworthy as the platform making it. A platform can therefore reach what a user was granted, including permissions broader than its own. That is deliberate: specificity is what makes a user grant mean anything, and a platform that can write to a vault can already act as its users in other ways.

What the header cannot do is escape a denial. Denials match the party, the platform carrying the request, **and** the party's groups, so a denied platform stays denied no matter whose name it puts in the header.

Only an `@`-prefixed eName is accepted as a party. Anything else — notably a JWT `kid`, which for a Registry-issued platform token is a signing-key id rather than a party — is ignored.

## The `_acl` block

The policy sits beside the payload in the record it protects.

```json
{
  "...payload...": "...",
  "_acl": {
    "v": 1,
    "grants": [ { "ename": "@<uuid>", "perms": 1 } ],
    "denials": {
      "enames": ["@<uuid>"],
      "conditions": []
    },
    "default_perms": 1,
    "require": [ [ { "ontology": "@<uuid>", "path": "$.score", "op": ">=", "value": 60 } ] ]
  }
}
```

Supply it on `createMetaEnvelope`, `storeMetaEnvelope`, `bulkCreateMetaEnvelopes`, `updateMetaEnvelope`, `updateMetaEnvelopeById`, or `uploadFile`.

An update that does not carry `_acl` leaves the stored policy alone rather than clearing it.

### Reading it back

`MetaEnvelope` exposes `_acl`, readable by anyone permitted to read the record.

```graphql
query {
  metaEnvelope(id: "…") {
    id
    _acl {
      grants { ename perms }
      denials { enames conditions { ontology path op value } }
      default_perms
      require { ontology path op value }
    }
  }
}
```

What comes back is always the policy **actually in force**. A record carrying only a legacy `acl` array reports the block that array is interpreted as, so callers see one shape regardless of how the record was written. The legacy array itself is never returned.

Because the policy is readable by any permitted reader, treat its contents as visible to them: a denial names the parties an owner has excluded, and the grant list names who else holds access.

## Relationship to the legacy `acl` array

The older `acl: ["*"]` array still works and is unchanged. Where a record has no `_acl`, the array is read as before. Where a record has one, **`_acl` is authoritative and the array is ignored**.

A legacy array is interpreted as:

- `["*"]` → `default_perms` of `0x0F` behind an always-passing group: anyone, everything.
- `["@some-ename"]` → a `0x0F` grant to that eName, and nobody else admitted.

This matters for one behaviour in particular. Under the legacy model, any platform holding a valid Registry-issued token could reach any record. **A record carrying an `_acl` block is decided by that block for every caller, token or not.** Closing that bypass is the point of the model. Records without a policy keep their existing behaviour exactly, so nothing narrows until an owner sets one.

## Current limits

- **Group membership is not resolved yet.** A grant or denial naming a group matches nothing. For grants that is fail-closed; for denials it is fail-**open**, so group denials are not usable yet.
- **Condition evaluation is a seam, not yet connected.** eVault accepts an evaluator but none is wired in, so conditions currently fail closed: a `require` group containing conditions cannot pass, and a deny condition always fires. Until an evaluator is connected, write policies that use `grants`, `denials.enames`, and empty-group `require` only.
- **Enforcement is eVault-side.** The Web3 Adapter and platforms do not evaluate `_acl` yet.
- `default_perms` above READ for unnamed parties is unsettled under the current sync model.

## See also

- [Implementing Access Control](/docs/Post%20Platform%20Guide/access-control) — how a platform sets a policy, with worked examples and the current gotchas
- [Access Policy](/docs/W3DS%20Basics/Access-Policy) — the owner's signed statement about *which platforms they will deal with at all*. That runs before this; the two are separate gates and neither can widen the other.
- [eVault](/docs/Infrastructure/eVault) — where the policy is stored and enforced.
- [eName](/docs/W3DS%20Basics/eName) — the party identifier.
