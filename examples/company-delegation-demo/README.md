# Company delegation demo

A one-page demonstrator of company signing delegation on the real local stack: real eVaults, real wallets (wallet-sdk, in-process), real `w3ds://sign` requests and real P-256 signatures. No phone, no editor.

Acme's board, roles and delegations are signed records in Acme's own eVault, set up from `demo.config.json`. Every signature made for Acme is checked by `verifyDelegatedSignature` against that eVault's history; the eVault itself enforces nothing.

## Run

```bash
pnpm dev:core                                  # Registry :4321, provisioner :3001, eVault :4000
pnpm --filter company-delegation-demo dev      # http://localhost:5180
```

The page is a short story in slides (← → to move). Each slide runs its step for real; the raw records are on `/dashboard.html`.

Dana founds Acme and makes Bob Head of Finance; Bob passes it to Dave, and Dave gives Tim NDAs only. Each hand-over is a Delegation record signed by the giver. Then eSigner verifies signatures by tracing each one back through Acme's eVault, hop by hop, to the board:

| Scenario | Expected |
|---|---|
| Tim signs an NDA for Acme | valid: Tim ← Dave ← Bob ← Dana |
| Tim signs an invoice | refused at Tim: Dave only gave him NDAs |
| Tim passes his badge to Mallory | refused at Mallory: Tim couldn't pass it on |
| Tim's signature replayed as a login | refused: reserved payload |
| Mallory writes herself onto the board | refused: nobody entitled granted it |
| Dana revokes Bob, Tim signs again | refused at Bob: revoked |

**Start fresh** (slide 0) clears Acme and Act 1 provisions a fresh company eVault; on the dashboard, **Start over with a new Acme** does both. Wallets are reused. Revoking Bob is permanent for that Acme, so the acts that need Tim's chain lock until you start fresh.

## Headless

```bash
pnpm --filter company-delegation-demo smoke
```

Runs setup and every scenario against the local stack and exits non-zero if any ends differently.

## Where things live

- `demo.config.json`: the company, people, roles and delegations.
- `.demo/state.json` (gitignored): generated eNames, wallet keys and record ids.
- `src/wallet.ts`: a wallet-sdk crypto adapter for Node, and the wallet's handling of a `w3ds://sign` URI (sign the session, POST to `redirect_uri`).
- `src/demo.ts`: setup and scenarios, using `buildGrantSignRequest`, `buildDelegatedSignRequest` and `verifyDelegatedSignature` from `@metastate-foundation/auth`.

Environment overrides: `REGISTRY_URL`, `PROVISIONER_URL`, `DEMO_VERIFICATION_ID`, `DEMO_PORT`.
