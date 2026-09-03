---
sidebar_position: 12
---

# ACL demonstrator

One page, one continuous walkthrough. You meet a cast, and then a single record has its access rules rewritten four times while the same handful of parties keep asking for it. Every request is real, against a live eVault, and every answer is the eVault's.

```bash
pnpm --filter acl-demo dev
```

Open **http://localhost:4410**, press *Set the stage*, then press **Next** (or `→`) about thirty times. It needs `PUBLIC_REGISTRY_URL`, `PUBLIC_PROVISIONER_URL` and `PUBLIC_ONTOLOGY_URL`, and nothing else.

There is no sign-in and nothing is written into your own eVault. The demo provisions the people it needs.

For the model itself see [Access Control](/docs/W3DS%20Protocol/Access-Control); for what to send, [Implementing Access Control](/docs/Post%20Platform%20Guide/access-control).

## The cast

Setting the stage provisions seven eVaults — Alice, Bob, Carol, two platforms, a group, and one for the app itself — then writes the group's manifest and Alice's note. All of them keyless: no key pair, no identity check, which is how platform and group eVaults are made in production too. Nothing in an access decision asks a party to hold keys. It asks the party to have an eName that resolves.

**Alice is the vault.** Everything is written into hers, and she is also a party in her own right. That is deliberate rather than convenient: there is no owner override anywhere in this model. A record whose policy names nobody holding `UPDATE` cannot be edited by anyone, Alice included. Every policy the walkthrough writes grants Alice `0x0F`, and that one line is the only reason the next chapter can rewrite the rules.

**A platform is only a party if its name is an eName.** eVault reads the `platform` claim on a request's bearer token and accepts it as an identity only when it is `@`-shaped, so a token minted for a bare name authenticates and then authorizes as nobody. Each platform here has a provisioned eName. Tokens are not mentioned in the walkthrough itself — they are the same in every step and would be noise on top of the two headers that actually decide anything.

## What each beat shows

Nothing is summarised. Every beat that runs prints:

- the `_acl` block stored on the note at the moment it ran — read back with `metaEnvelope`, never remembered from what was written, because the create and update mutations build their response without the policy
- the GraphQL query and the variables that went out, and the headers that identify the party
- the response, verbatim

A beat that changes a policy prints it before and after. A beat that moves a group prints the membership before and after, beside the policy that did not change.

## The four chapters

**One — not everyone gets the same key.** Alice writes her first policy. Northwind holds `1`, Halcyon holds `15`. Northwind reads, then cannot change — while being named in the policy, because a grant decides on its own and never falls through to `default_perms` looking for something better. Halcyon makes the same edit and it lands.

**Two — whose request is this?** Halcyon holds `15`; Bob holds `5`. Acting for Bob it reads, then tries to delete and is refused — on a note it could delete in its own name. A grant to a user is more specific than a grant to a platform, so it decides alone and the platform's broader grant is never consulted. Then Halcyon drops the `X-ON-BEHALF-OF` header and the identical mutation comes back `success: true`. The two requests sit next to each other, one header apart.

**Three — the one you cannot argue with.** Northwind is granted `15` and named in `denials.enames`. Refused. It tries again claiming to act for Alice — who owns the vault and holds `15` on that very note — and is refused again: the header is unproven, so denials match the platform carrying a request as well as the name written into it. Bob then reaches the same note through a platform that was never denied, at `default_perms` behind an empty `require` group.

**Four — the list moves.** Alice replaces the policy with one grant, to the Reading Circle. Carol reads. Carol is taken out of the group — one write, to the manifest, in the group's own eVault. She asks again and is refused, under a policy printed both times and identical both times. Then she goes back in. This is what naming a group buys: membership moves and no policy anywhere is rewritten.

## Two things worth knowing while watching

**A refusal arrives as `Unexpected error.`** The specification says `Access denied`, but the GraphQL server masks errors it did not raise itself, so the reason does not survive the trip. The page says so, and is explicit that the paragraph under each beat is its own reading of the JSON above it rather than the eVault's account of its decision.

**The later chapters are slower.** Beats where nobody is matched by a direct grant take a few seconds, because the decision falls through to group resolution, which scans the graph for group records. The page shows what it is running while it waits.

## See also

- [Access Control](/docs/W3DS%20Protocol/Access-Control) — the protocol model and wire format
- [Implementing Access Control](/docs/Post%20Platform%20Guide/access-control) — what to send, and what will bite you
- [Access Policy](/docs/W3DS%20Basics/Access-Policy) — the owner's signed statement about which platforms they will deal with at all, a separate gate from this one
