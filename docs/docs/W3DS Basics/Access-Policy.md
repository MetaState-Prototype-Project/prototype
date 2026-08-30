---
sidebar_position: 6
---

# Access Policy

Certification tells you what a platform was found to be. It does not tell you whether you want to deal with it. That is the eVault owner's decision, and an **access policy** is where they write it down.

It is a signed statement rather than a stored setting, so it travels with the owner and anyone can check it — the eVault enforcing it, a platform working out whether it is even worth asking, or the owner auditing what they agreed to months later.

## What an owner sets

| Term | Meaning |
|---|---|
| `minimumLevel` | The weakest certification level they will deal with. A platform certified below it is refused whatever its certificate grants. |
| `reputationEngine` | Whose reputation scores they accept, as an eName or URL. Blank means reputation is not consulted at all. |
| `minimumReputation` | The score that engine must report for the platform. Null means no threshold. |
| `allowedDomains` | Null means "whatever the certificate grants" — the ordinary case. A list narrows it further. |
| `deniedDomains` | Refused outright, overriding both the certificate and the allow list. |

Naming the engine matters. A score is only meaningful relative to how it was calculated, so the owner elects which calculation they accept rather than inheriting whichever engine a platform happens to cite. A score from an engine the owner did not name counts as no score at all.

## A policy can only narrow

An owner permitting `finance` does not let a social platform reach finance data. The certificate gate runs first and independently: if `finance` is not in what the association granted the release, nothing in the owner's policy can put it there.

This ordering is the point. The owner's terms are a second lock, not a master key.

## The statement

```json
{
  "subject": "@849c0221-6f3f-55f9-95f0-f3b0d2b3092f",
  "minimumLevel": "L3",
  "reputationEngine": "@ereputation.w3ds",
  "minimumReputation": 40,
  "allowedDomains": null,
  "deniedDomains": ["health"],
  "issuedAt": "2026-08-30T16:04:11.230Z",
  "nonce": "0f1c…"
}
```

Signed by the owner's wallet over `w3ds:access-policy:v1:` + base64url(sha256(canonical statement)). The signer must be the subject: a policy signed by anyone else is somebody setting terms on a vault that is not theirs, and is rejected.

The newest statement for a subject is the one in force. An owner who has never set one is treated as requiring **L2** — the lowest level the framework issues to a release whose responsible people are identified at all.

Published as the `Access Policy` ontology (`c7a41f6d-95b8-4e2a-9c33-8f0d1b6e4a72`), domain `governance`.

## See also

- [Platform Authentication](/docs/W3DS%20Protocol/Platform-Authentication) — how a platform proves which release it is running
