---
sidebar_position: 9
---

# PP Auth demonstrator

A running demonstration of platform authentication and domain separation. Two platforms, one vault, and every attempt to reach data shown with the reason it succeeded or failed.

```bash
pnpm --filter pp-auth-demo dev
```

Then open **http://localhost:4310**. Nothing else needs to be running — no database, no registry, no eVault.

## What it shows

**Chatterbox** is a social platform, certified L3 for `social` and `communication`. **Ledgerly** handles money, certified L4 for `finance`. Both are live, both will try to reach everything in the vault.

Point either one at a domain it was not certified for and it is refused — with a sentence saying so, not a status code. The refusal does not come from a list of platform names: it comes from the certificate the deployment presented, which does not name that domain and cannot be made to.

**Your terms** sets the owner's side: the minimum level, whose reputation scores count and what score they must reach, and any domain refused outright. Signing produces a real signature over a real statement, which is verified before it takes effect. Raise the bar to L4 and Chatterbox stops being allowed anything; require a reputation of 50 and Ledgerly does, on the scores the demo's engine reports.

**Try to cheat** is where the mechanism is visible. Each edit breaks exactly one link:

| Edit | Fails at |
|---|---|
| Present a different public key — paste your own | Possession |
| Widen its own authorisation | Deployment authorised |
| Borrow the other platform's version document | Bundle integrity |
| Point at a different release | Version identity |
| Borrow the other platform's certificate | Accreditation |

The chain trace re-runs on every attempt, so you can watch a link go red and read why.

## What is real and what is not

The signatures are real — P-256 and ES256, verified by exactly the same code that verifies a live deployment. The tampering really does fail, for the reason shown.

What is simulated is who holds the keys. The deployer's wallet, the registry and the association are stood in for by keys generated in the demo process, so it runs on its own. A chain that verifies here proves the mechanism works. It proves nothing about any particular platform, which is what the real roots are for.

The minting facility lives at `@metastate-foundation/auth/platform/scenario`, deliberately behind a separate entry point so it cannot be reached by accident from code that verifies real deployments.

## See also

- [Platform Authentication](/docs/W3DS%20Protocol/Platform-Authentication)
- [Access Policy](/docs/W3DS%20Basics/Access-Policy)
