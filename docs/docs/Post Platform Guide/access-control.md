---
sidebar_position: 6
---

# Implementing Access Control

Your platform writes records into a user's eVault. By default those records are wide open — anything that syncs to a platform can be read by it. This page is how you narrow that.

For the model itself — the bitmask, specificity, the decision order — see [Access Control](/docs/W3DS%20Protocol/Access-Control) in the protocol section. This page is the practical side: what to send, what comes back, and what will bite you.

## What you get if you do nothing

The Web3 Adapter writes every record with `acl: ["*"]`. That means anyone, everything, and it is what all existing platform data looks like today.

Nothing about that changes on its own. Records with no `_acl` block keep behaving exactly as they always have, including the part where any platform holding a valid Registry-issued token can reach them. You opt in per record by sending a policy.

## Setting a policy

`_acl` is an optional field on the same inputs you already use.

```graphql
mutation {
  createMetaEnvelope(input: {
    ontology: "550e8400-e29b-41d4-a716-446655440001"
    payload: { content: "…", authorId: "…" }
    acl: ["*"]
    _acl: {
      v: 1
      grants: [
        { ename: "@7b9c2e1a-4f30-4c5e-9a21-d8e0f1a2b3c4", perms: 15 }
        { ename: "@2d4f6a8b-1c3e-4d5f-8a9b-0c1d2e3f4a5b", perms: 1 }
      ]
      denials: { enames: [], conditions: [] }
      default_perms: 0
      require: []
    }
  }) {
    metaEnvelope { id }
    errors { message }
  }
}
```

The owner gets `15` (`0x0F`, everything); one platform gets `1` (`0x01`, read). Nobody else is admitted: `require: []` means no group can pass, so step 3 always refuses.

Send `acl` as well. It is still required by the schema, and it is what any record without a policy falls back to — but where `_acl` is present it is ignored entirely, so its value does not matter.

Available on `createMetaEnvelope`, `storeMetaEnvelope`, `updateMetaEnvelope`, `updateMetaEnvelopeById`, `bulkCreateMetaEnvelopes`, and `uploadFile`.

## Permission values

| Want | `perms` | Hex |
|---|---|---|
| Read only | `1` | `0x01` |
| Read + add, but not edit | `3` | `0x03` |
| Read + edit | `5` | `0x05` |
| Everything | `15` | `0x0F` |

Bits: `1` READ, `2` CREATE, `4` UPDATE, `8` DELETE. Union them.

Two values to avoid sending by accident:

- **`0`** is not "no permissions", it is *no grant at all* — the party falls through to the ontology step as though you had never named them. To actually give someone nothing, leave them out and let the default refuse them.
- **Anything above `15`** is rejected outright. Bits 4–7 are reserved, and a write that sets one fails loudly rather than being quietly narrowed.

## Common shapes

**Owner-only.** Nothing but the owner, no fallback.

```json
{ "v": 1,
  "grants": [ { "ename": "@owner", "perms": 15 } ],
  "denials": { "enames": [], "conditions": [] },
  "default_perms": 0,
  "require": [] }
```

**Public read, owner writes.** The empty group always passes, so anyone reaches `default_perms`.

```json
{ "v": 1,
  "grants": [ { "ename": "@owner", "perms": 15 } ],
  "denials": { "enames": [], "conditions": [] },
  "default_perms": 1,
  "require": [ [] ] }
```

This is the closest equivalent of the legacy `["*"]`, except that everyone other than the owner is now read-only rather than able to write.

**Public read, one platform excluded.**

```json
{ "v": 1,
  "grants": [ { "ename": "@owner", "perms": 15 } ],
  "denials": { "enames": ["@2d4f6a8b-1c3e-4d5f-8a9b-0c1d2e3f4a5b"], "conditions": [] },
  "default_perms": 1,
  "require": [ [] ] }
```

A denial beats everything, including a grant to the same party. This is how a user shuts out a platform they do not trust without having to enumerate the ones they do.

**Append-only log.** A collaborator may add entries but never rewrite or remove one.

```json
{ "v": 1,
  "grants": [ { "ename": "@owner", "perms": 15 },
              { "ename": "@collaborator", "perms": 3 } ],
  "denials": { "enames": [], "conditions": [] },
  "default_perms": 0,
  "require": [] }
```

## Acting on behalf of a user

Your platform's token proves your platform. It says nothing about which of your users a request is for, which matters as soon as a policy grants anything at user level.

Send the user's eName in `X-ON-BEHALF-OF`:

```http
POST /graphql
Authorization: Bearer <your platform token>
X-ENAME: @<vault owner>
X-ON-BEHALF-OF: @<the user you are acting for>
```

That user becomes the party the policy is evaluated against, and your platform is recorded alongside them — so a user grant applies at user specificity while a grant to your platform still applies at platform specificity. Omit the header and your platform is the party.

Two things to be clear about:

- **It is your assertion, not a proof.** The eVault has no way to check it, so it trusts you. That also means it will let you reach what the user was granted, which may be broader than your own grant. Do not send a user's eName on a request that user did not actually initiate.
- **It will not get you past a denial.** Denials match your platform as well as the asserted user, so a policy that excludes your platform still excludes it whatever name you send.

Only `@`-prefixed eNames count as parties. Anything else is ignored rather than treated as an identity.

## Reading a policy back

`_acl` is a field on `MetaEnvelope`:

```graphql
query {
  metaEnvelope(id: "…") {
    _acl {
      grants { ename perms }
      denials { enames }
      default_perms
    }
  }
}
```

You always get the policy actually in force. A record written with only `acl: ["*"]` reports `default_perms: 15` behind an always-passing group rather than returning the array, so you can render one consistent view without caring how the record was written.

## Things that will bite you

**A grant is final.** If your platform is named in `grants`, that grant decides the answer on its own. It never falls through to `default_perms` — so a platform granted `1` on a record whose `default_perms` is `15` has read access, not full access. Being named is not always an upgrade.

**The most specific grant wins outright.** A grant to a user beats one to a platform, and they are not combined. If a record grants your platform `15` and the acting user `1`, a request carrying that user identity gets `1`. The platform's broader grant is not consulted.

**A valid platform token does not open a policied record.** It still works on records with no `_acl`. That bypass is exactly what a policy exists to close, so do not rely on your token to reach data a user has locked down — handle the refusal instead.

**Updates preserve the policy.** An `updateMetaEnvelope` that omits `_acl` leaves the stored policy alone rather than clearing it. To change a policy, send the new one in full — it replaces, it does not merge.

**A policy is visible to everyone who can read the record.** `_acl` is returned, not stripped — so your denial list tells any permitted reader which platforms the user excluded, and your grant list tells them who else has access. Do not put anything in a policy you would not show to its readers.

**Refusals look like two different things.** A record you may not touch raises `Access denied`. A record that does not exist for that eName returns `null`. Do not treat the second as the first — retrying will not help, and neither will asking for a different verb.

## The adapter does not do this yet

`EVaultClient` hardcodes `acl: ["*"]` and has no `_acl` parameter, so records written through `handleChange` cannot carry a policy today. To set one, call the eVault GraphQL endpoint directly for that record.

Everything else about your integration is unchanged — mapping, webhooks, and the Awareness Protocol do not interact with the policy. The policy is stored inside the record, so it travels with the data when it syncs, without your webhook controller doing anything.

## Not usable yet

Two parts of the protocol document are specified but not connected, and a policy relying on them will not behave as written:

- **Groups.** Group membership is not resolved, so a grant or denial naming a group matches nobody. A group grant simply fails to apply; a **group denial silently fails to deny**, which is the dangerous direction. Name parties individually for now.
- **Ontology conditions.** No evaluator is wired in, so any condition fails. A `require` group containing conditions can never pass, and a deny condition always fires and refuses everyone. Until that lands, use only `grants`, `denials.enames`, and `require: []` or `require: [[]]`.

Enforcement is eVault-side. Platforms and the adapter do not evaluate policies themselves, so do not treat a policy as a reason to skip your own authorization checks.

## See also

- [Access Control](/docs/W3DS%20Protocol/Access-Control) — the protocol model and wire format
- [eVault](/docs/Infrastructure/eVault) — where policies are stored and enforced
- [Webhook Controller](/docs/Post%20Platform%20Guide/webhook-controller) — the inbound side, unaffected by policies
