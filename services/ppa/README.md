# Post Platforms Association (PPA)

Admin app where a whitelisted group of reviewers vets platforms applying to
join the network and issues **L1–L5 access decisions as signed statements**.

- **Submissions** are read from Awareness-as-a-Service: platform profiles
  (User ontology, tagged `platformName`) that also carry `inSubmission: true`.
- **Authors** are resolved from their own eVault profiles, with a "Message"
  button that deep-links into whichever messenger platform is currently
  published on AaaS — nothing is hardcoded.
- **Decisions certify one platform version.** A grant carries an access level
  (L1–L5) and the **areas of access** it covers — domains published by the
  ontology service, which every schema is tagged with. Shipping a new version
  means a new review; the old certificate does not carry over.
- **Decisions** are ES256 JWS statements written into the eVault of the platform
  they are about, with a public ACL, so the record travels with that platform.
  The association owns no vault and no database: its identity is a signing key,
  and every decision verifies against `/.well-known/jwks.json` without trusting
  the app or the eVault holding it. They are read back by their own ontology id
  — one small query, not a scan.

Runs on **port 4210** (`--strictPort`, so it never takes a port from anything
else). SvelteKit + Tailwind 4 + `adapter-node`.

## Setup

All configuration lives in the repo-root `.env`; see the `PPA_*` block in
`.env.example`.

**1. Signing key** — the identity behind every statement:

```sh
pnpm --filter ppa generate-jwk    # -> PPA_SIGNING_JWK
```

Left unset, an ephemeral key is generated per process: fine for a first look,
but every statement stops verifying on restart.

**2. The admin whitelist** — `config/admin-enames.json`:

```json
{ "admins": ["@your-ename"] }
```

Re-read on change, so an eName can be added or removed without a restart, and
removal revokes any live session on the next request. `PPA_ADMIN_ENAMES` (csv)
is merged in for deployments where mounting a file is awkward.

**3. An AaaS consumer key** — approve a consumer in the AaaS portal, issue a
key, and set `PPA_AWARENESS_API_KEY` (it falls back to `AWARENESS_API_KEY`).

**4. Run:**

```sh
pnpm --filter ppa dev      # http://localhost:4210
```

## Trying it locally

Nothing in the repo writes `inSubmission` yet, so there is a dev-only fixture
that provisions throwaway eVaults holding an author profile and a platform
asking for access:

```sh
pnpm --filter ppa seed:submission
```

## Verifying a statement

A decision is self-contained — a verifier needs the JWS and the issuer's key
set, nothing else:

```sh
curl -s localhost:4210/.well-known/jwks.json
```

```js
import { jwtVerify, createLocalJWKSet } from "jose";

const jwks = await (await fetch(`${issuer}/.well-known/jwks.json`)).json();
const { payload } = await jwtVerify(jws, createLocalJWKSet(jwks));
// { decision, level, statement, reviewedBy, sub: <platform eName>, iss, jti, iat }
```

`issuerJwksUri` on the stored record points at the right key set. Editing any
claim — the level above all — invalidates the signature.

## Notes

- Decisions are **append-only**. A re-decision writes a new record into the
  platform's eVault and the newest one is in force; nothing is rewritten.
- The PPA is deliberately **not** in the Registry's platform list. That list
  drives AaaS catch-all webhook fanout, and the PPA polls rather than receives,
  so registering it would only produce dead-letters. It still mints a platform
  token from `POST /platforms/certification`, which is issued for any name.
