# Company delegation

How a company signs on W3DS: directors hand out titled roles, people sign **for** the company with their own keys, and verifiers trace each signature back to the company's board. Sources:

- [Company Delegation](https://docs.w3ds.metastate.foundation/docs/W3DS%20Protocol/Company-Delegation): the model.
- [Signing for a Company](https://docs.w3ds.metastate.foundation/docs/Post%20Platform%20Guide/signing-for-a-company): platform integration.

Resolve the ontology ids (Company, Role, Delegation, Shareholding, DelegatedSignature) from the ontology service or the docs page. They are also exported as constants from `@metastate-foundation/delegation`.

## Model in brief

- **Company eVault.** It is keyless, and its `/whois` reports `type: "company"`, with the Company record as its manifest.
- **Company record.** It holds `directors[]`. A board counts only if the record's **first version** carries it, signed by one of its own directors. After that, only a sitting director may change it. Any one director may create roles and grant or revoke delegations.
- **Role.** It has a `title`, `scopes`, `mayRedelegate` and `appLimits`. It is created and signed by a director.
- **Delegation.** It sets exactly one of `roleId` (granted by a director) or `parentDelegationId` (granted by the parent's delegate, only if the parent allows it). Its scopes must be a subset of what it came from. Revocation is a signed version with `status: "revoked"`, and it is final. It stops only that record: grants it made before stay valid, unless `revocationCascade: true`. Effective scopes are the intersection of every link's current scopes, so narrowing always flows down.
- **Scopes.** Either `ontology:<schemaId>` or `@<platform-eName>:<keyword>`. Identity, the company's own authority records and the `@w3ds` namespace can **never** be delegated.
- **The eVault enforces nothing.** It stores any write. Authority is decided only by the verifier, from signatures and version history.

## Signatures

- Records carry `authorization: { signerEName, signedPayload, signature, signedAt }`.
  - `signedPayload` is a `w3ds-grant/v1` string binding the company, ontology, **record id**, a **hash of the record** and **signedAt**.
  - So a copied, edited or written-back record fails verification.
  - Writers pick the record id before signing, and create the record with `updateMetaEnvelope(id, …)`.
- A delegate signs a `w3ds-sign/v1` payload: `onBehalfOf`, `signer`, `scope`, `delegationId`, `documentHash`, `session` and `issuedAt`, as canonical JSON.
- Both go through an ordinary `w3ds://sign` request, with **the payload as the session**. No wallet changes are needed.
- Anything starting with `w3ds-` is never a login. `verifyLoginSignature` refuses it.

## Platform code

```ts
import { buildDelegatedSignRequest, verifyDelegatedSignature } from "@metastate-foundation/auth";

const { uri, payload } = buildDelegatedSignRequest({ onBehalfOf, signer, scope, delegationId,
    documentHash, session, redirectUri, title, companyName });
// …wallet POSTs { sessionId: payload, signature } to redirectUri…
const r = await verifyDelegatedSignature({ payload: body.sessionId, signature: body.signature,
    registryBaseUrl, platformToken });
// r.valid, r.title, r.scopes, r.chain, r.appLimits (satisfy every one), r.error / r.detail
```

- **Retryable errors:** `resolve_failed`, `history_failed`, `timeout`.
- **Refuse:** everything else, e.g. `not_covered` (scope), `chain_invalid` (with `detail` such as `REVOKED`, `NOT_FOUND` or `REDELEGATION_NOT_ALLOWED`), `bad_signature`, `not_a_company`.
- After accepting, write a DelegatedSignature audit record into the company's eVault.
- Tools that grant use `buildGrantSignRequest`, which returns the `payload`, `signedAt` and normalised `signerEName` to store as `authorization`.

## Gotchas

- **Don't add company or delegation checks to evault-core.** The eVault stays a plain store, and checks belong in verifiers.
- **Don't delete authority records to revoke them.** Verifiers read history, so deleting does nothing. Write a signed revoked version instead.
- **Firing doesn't cascade by default.** Revoking Bob stops Bob, but what he granted before stays valid. Use `revocationCascade: true` to take everything below. Anything Bob signs after being fired is ignored.
- **`appLimits` are opaque to the model.** The platform enforces them, and must satisfy every link's limits.
- **Verifiers read at most 2,000 versions of any one record.**
- **There are no use-count limits.** Use validity windows instead.
- **Demonstrator:** `examples/company-delegation-demo`, run with `pnpm dev:core` and then `pnpm --filter company-delegation-demo dev`.
