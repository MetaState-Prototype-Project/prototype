---
sidebar_position: 1
---

# Glossary

Definitions of key terms used across the W3DS and MetaState documentation. Where a concept is explained in more detail elsewhere, a link is provided.

---

## Access

The ability to retrieve or interact with data or services based on permissions and [authentication](#authentication). In W3DS, access to eVault data is governed by [ACLs](/docs/Infrastructure/eVault#access-control) and [resolution](/docs/Infrastructure/Registry#get-resolve) of identities.

---

## Authentication

The process of verifying the identity of a user or identifier. In W3DS, users authenticate using their [W3ID](/docs/W3DS%20Basics/W3ID) via the `w3ds://auth` protocol; see [Authentication](/docs/W3DS%20Protocol/Authentication) for details.

---

## Authorized Agent

A user or software that has been authorized by another user to act on their behalf. Examples: Bob allows Alice to act on his behalf to file taxes; Bob authorizes a social network app to perform certain operations on his behalf, which may require the app to sign for him. See [eVault Key Delegation](/docs/Infrastructure/eVault-Key-Delegation) for delegation in the prototype.

---

## Charter

A cryptographically signed document outlining group governance, rules, and regulations. Groups in MetaState can have charters that define how the group operates and who can perform which actions.

---

## Credential

A set of data relating to an identifier that is signed by an issuing party (e.g. a school diploma). See [Verifiable Credential (VC)](#verifiable-credential-vc).

---

## eID (ePassport)

A document, similar to X.509, which binds a user's [W3ID](#web-30-identifier-w3id-ename) and the user's [Public Key](#public-key). It is signed by a [digital] notary participating in PKI. See [eID Wallet](/docs/Infrastructure/eID-Wallet) for how the prototype uses eID and key binding.

---

## eIDAS 2.0

An updated European Union regulation aimed at enhancing the security and reliability of electronic identification and trust services.

---

## Entity

A non-human object within the MetaState such as an organization, a platform, a business, a [Group](#group), a device, etc. that has its own [eVault](#evault) and can hold or verify credentials.

---

## Envelope

The smallest unit of data in an [eVault](#evault), addressable by its unique identifier and [ontology](/docs/Infrastructure/Ontology) reference. Each envelope has an attached ontological definition and ACL that defines who is allowed to access it. See [eVault — Data Model](/docs/Infrastructure/eVault#data-model) for how Envelopes are stored and used.

---

## eVault

A secure storage location or server for the management of data and credentials of a [User](#user), [Post-Platform](#post-platform-and-or-service), or [Group](#group). In W3DS, each user or group has their own eVault identified by a [W3ID](/docs/W3DS%20Basics/W3ID). See [eVault](/docs/Infrastructure/eVault) for the full architecture and API.

---

## Group

An [Entity](#entity): a reference to a number of users within the MetaState that holds its own [W3ID](#web-30-identifier-w3id-ename) and [eVault](#evault). It is often seen as a "group" in social networks.

---

## Interoperability Profile

A set of technical standards and protocols that enable different systems to work together seamlessly. W3DS uses a shared [ontology](/docs/Infrastructure/Ontology) and [Web 3 Protocol](#web-3-protocol) as part of its interoperability profile.

---

## Key Rotation

The practice of changing cryptographic keys to enhance security on a regular basis or in an emergency. See also [Revoked keys / e-passports] (e.g. when an eID or key is revoked and a new one must be issued).

---

## MetaState

The name of the current social-oriented project that uses the [Web 3.0 Data Space (W3DS)](#w3ds) architecture. It uses [eVaults](#evault) and unique identifiers, allowing [Post-Platforms](#post-platform-and-or-service) to access data from a user's eVault and interact with it based on [authorization](#access) and permissions. See [Getting Started](/docs/Getting%20Started/getting-started) for an overview.

---

## MetaState Prototype

The current project to deliver the Prototype of the MetaState at TRL6, with the minimum required features and developments to produce the required functionality.

---

## MetaEnvelope

To group related pieces of data, [Envelopes](#envelope) are linked together using a **MetaEnvelope**. Each MetaEnvelope has its own ID and points to the individual envelopes it includes. This makes it easy to bundle related info, track changes over time, and move or reference sets of data as one unit. It also helps fix duplicates by pointing everything to the correct version of an entity. See [eVault — Data Model](/docs/Infrastructure/eVault#data-model) and [Awareness Protocol](/docs/W3DS%20Protocol/Awareness-Protocol) for how MetaEnvelopes are stored and synced.

---

## Ontology Dictionary

A service that maps keys as defined in a [Post-Platform](#post-platform-and-or-service) to the schema definition of how data is referenced when stored in an [eVault](#evault). Example: a post platform might refer to a name as `"firstName"` but it is stored as `"given_name"` in the vault; the [Web3 Adapter](/docs/Infrastructure/Web3-Adapter) stores the reference so that when the platform refers to `"firstName"`, it means write/update/get `"given_name"` on the vault. See [Ontology](/docs/Infrastructure/Ontology) and [Web3 Adapter](/docs/Infrastructure/Web3-Adapter) for implementation.

---

## Physical Binding Documents

Signed documents by the Root CA in the system that state that an [eName](/docs/W3DS%20Basics/W3ID) belongs to a user who owns a certain physical identity document.

---

## Post-Platform (and/or Service)

A service or platform that can operate with [eVaults](#evault) in the W3DS (dataless) mode. Post-platforms sync data with eVaults via the [Web3 Adapter](/docs/Infrastructure/Web3-Adapter) and [Awareness Protocol](/docs/W3DS%20Protocol/Awareness-Protocol). See [Post Platform Guide](/docs/Post%20Platform%20Guide/getting-started).

---

## Private Key

A cryptographic key kept secret (e.g. in the crypto-engine of the phone) by its owner, used for digital signatures and decryption. See [Signing](/docs/W3DS%20Protocol/Signing) and [eID Wallet](/docs/Infrastructure/eID-Wallet).

---

## Provisioner

Software that creates, controls, and updates [eVaults](#evault). In the prototype, it is the "cloud service provider" software that creates eVaults. See [Getting Started — Provisioning](/docs/Getting%20Started/getting-started#provisioning-flow) for the flow.

---

## Public Key

A cryptographic key derived from the corresponding [Private Key](#private-key). It can be freely shared in the form of an e-passport (public key certificate) and is used for encryption and signature verification. See [Registry — Key binding](/docs/Infrastructure/Registry#key-binding-certificates) and [eVault — Key Binding](/docs/Infrastructure/eVault#key-binding-certificates).

---

## Registry

A [Post-Platform](#post-platform-and-or-service) service for discovering, storing, and retrieving information about identifiers and their eVaults/IP. In W3DS, the [Registry](/docs/Infrastructure/Registry) resolves [eNames](/docs/W3DS%20Basics/W3ID) to eVault URLs and provides entropy and key binding certificates.

---

## Resolution

The process of retrieving and verifying keys or identifiers using their specific syntax to query the corresponding network or [Registry](/docs/Infrastructure/Registry). See [Registry — Resolve](/docs/Infrastructure/Registry#get-resolve) and [W3ID — Registry Resolution](/docs/W3DS%20Basics/W3ID#registry-resolution-ename).

---

## Search Platform

A platform that provides search/discovery service to other platforms that need to find certain users, groups, files, etc.

---

## Selective Disclosure

The ability to share only specific parts of data from within a [Credential](#credential) or information set.

---

## User

An individual who owns and controls their digital identity and [eVault](#evault), interacting within the MetaState via any service of their choice.

---

## User Flow

The sequence of steps a user takes to complete a task or interaction within a system.

---

## User Journey

The overall experience and path a user follows when interacting within an interactive MetaState experience.

---

## Verification

The process of confirming the authenticity and validity of an identity, [Credential](#credential), action, or claim. In W3DS, platforms verify signatures using public keys resolved via the [Registry](/docs/Infrastructure/Registry) and [eVault](/docs/Infrastructure/eVault) (e.g. `/whois`).

---

## Verifiable Credential (VC)

A standardized data model format for [credentials](#credential) that can be cryptographically signed and verified.

---

## W3DS

**Web 3.0 Data Space**: the basic architecture scheme used in the MetaState Prototype. It is a protocol that enables data synchronization across multiple platforms while ensuring users own and control their data in [eVaults](/docs/Infrastructure/eVault). See [Getting Started](/docs/Getting%20Started/getting-started).

---

## Web 3.0 Identifier (W3ID / eName)

A globally or locally unique, persistent identifier for people, [eVaults](#evault), [Groups](#group), [Post-Platforms](#post-platform-and-or-service), docs, or triples. It enables verifiable, persistent, and decentralized digital identity.

The Web 3.0 Identifier format is `@<UUID>` for global identifiers (eNames), e.g. `@50e8400-e29b-41d4-a716-446655440000`. Local identifiers are plain UUIDs.

See [W3ID](/docs/W3DS%20Basics/W3ID) for format, resolution, and usage.

---

## Web3 Adapter

Software that runs next to a [Post-Platform](#post-platform-and-or-service) and is responsible for syncing the platform's DB with all relevant [eVaults](#evault). It maps local schema to the global [ontology](/docs/Infrastructure/Ontology) and handles [Awareness Protocol](/docs/W3DS%20Protocol/Awareness-Protocol) webhooks. See [Web3 Adapter](/docs/Infrastructure/Web3-Adapter).

---

## Web 3 Protocol

The query language that a [Web3 Adapter](#web3-adapter) (or a Post-Platform without a Web3 Adapter) uses to talk to an [eVault](#evault). In the prototype, this is implemented as the [eVault GraphQL API](/docs/Infrastructure/eVault#graphql-api).

---

## Web Triad

A **Digital Self** triad: (1) [eName](/docs/W3DS%20Basics/W3ID) (W3ID), (2) ePassport ([eID](#eid-epassport)), (3) [eVault](#evault).
