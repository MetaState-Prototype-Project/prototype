# Company delegation demo

A one-page demonstrator of company signing delegation on the real local stack: real eVaults, real wallets (wallet-sdk, in-process), real `w3ds://sign` requests and real P-256 signatures. No phone, no editor.

Acme's board, roles and delegations are signed records in Acme's own eVault, set up from `demo.config.json`. Every signature made for Acme is checked by `verifyDelegatedSignature` against that eVault's history; the eVault itself enforces nothing.

## Run

```bash
pnpm dev:core                                  # Registry :4321, provisioner :3001, eVault :4000
pnpm --filter company-delegation-demo dev      # http://localhost:5180
```

Press **Set up Acme**, then run the scenarios:

| Scenario | Expected |
|---|---|
| Bob signs an NDA for Acme | valid, as "Head of Finance" |
| Bob signs an invoice | refused, not in his delegation |
| Carol signs an NDA, re-delegated by Bob | valid, as "NDA signer" |
| Bob's NDA signature replayed as a login | refused, reserved payload |
| Mallory writes herself onto Acme's board and delegates to herself | refused, her records are ignored |
| Dana revokes Bob, then Bob and Carol try again | both refused |

**Start over with a new Acme** provisions a fresh company eVault; the people's wallets are reused.

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
