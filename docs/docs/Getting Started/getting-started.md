---
sidebar_position: 1
---

# Getting Started with W3DS

Welcome to **W3DS (Web 3 Data Spaces)** - a decentralized data synchronization protocol that puts users in control of their data.

## What is W3DS?

W3DS is a protocol that enables seamless data synchronization across multiple platforms while ensuring users own and control their data. Instead of platforms storing user data in silos, W3DS allows users to store their data in their own **eVaults** and have platforms sync from these vaults.

## Core Concept

The fundamental principle of W3DS is simple: **Users, groups, and objects own their own eVaults**. All data about a person, group, or object is stored in their eVault, and platforms become frontends that display and interact with this data.

### Key Principles

1. **Data Ownership**: Users own their data, not platforms
2. **Platform Independence**: Platforms are interchangeable frontends
3. **Automatic Synchronization**: Data created on one platform automatically appears on all platforms
4. **Decentralized Storage**: Each user has their own eVault for data storage

## How It Works: A Simple Example

Imagine User A creates a post on **Blabsy** (a social media platform):

1. User A posts "Hello, world!" on Blabsy
2. Blabsy's Web3 Adapter syncs the post to User A's eVault
3. User A's eVault stores the post and notifies all registered platforms
4. **Pictique** (another social media platform) receives the notification
5. Pictique creates the post locally - User A now has a post on Pictique **without ever visiting Pictique**

This is the power of W3DS: your data follows you across all platforms automatically.

## Architecture Overview

```mermaid
graph TB
    subgraph Users["Users & Groups"]
        UserA[User A<br/>eName: @user-a.w3id]
        UserB[User B<br/>eName: @user-b.w3id]
        Group1[Group 1<br/>eName: @group-1.w3id]
    end

    subgraph EVaults["eVaults"]
        EVaultA[User A's eVault]
        EVaultB[User B's eVault]
        EVaultG1[Group 1's eVault]
    end

    subgraph Platforms["Platforms"]
        Blabsy[Blabsy]
        Pictique[Pictique]
        OtherPlatform[Other Platforms]
    end

    subgraph Infrastructure["Infrastructure"]
        Registry[Registry Service<br/>W3ID Resolution]
        EVaultCore[eVault Core<br/>GraphQL API]
    end

    UserA -->|Owns| EVaultA
    UserB -->|Owns| EVaultB
    Group1 -->|Owns| EVaultG1

    Blabsy -->|Read/Write| EVaultA
    Pictique -->|Read/Write| EVaultA
    OtherPlatform -->|Read/Write| EVaultA

    EVaultA -->|Webhooks| Blabsy
    EVaultA -->|Webhooks| Pictique
    EVaultA -->|Webhooks| OtherPlatform

    Blabsy -->|Resolve eName| Registry
    Pictique -->|Resolve eName| Registry
    EVaultCore -->|Store Data| EVaultA

    style UserA fill:#e1f5ff,color:#000000
    style EVaultA fill:#fff4e1,color:#000000
    style Blabsy fill:#e8f5e9,color:#000000
    style Pictique fill:#e8f5e9,color:#000000
    style Registry fill:#f3e5f5,color:#000000
    style EVaultCore fill:#f3e5f5,color:#000000
```

## Key Components

### eVault Core

The **eVault Core** is the central storage system that manages user data. It provides:

- **GraphQL API** for storing and retrieving data
- **Webhook delivery** to notify platforms of data changes
- **Access control** via ACLs (Access Control Lists)
- **MetaEnvelope storage** for structured data

### Web3 Adapter

The **Web3 Adapter** is a library that platforms use to:

- Sync local database changes to eVaults
- Convert between platform-specific schemas and global ontology schemas
- Handle bidirectional data synchronization

### Registry Service

The **Registry Service** provides:

- **W3ID resolution**: Maps eNames (like `@user-a.w3id`) to eVault URLs
- **Key binding certificates**: Stores public keys for signature verification
- **Platform registration**: Tracks active platforms for webhook delivery

### Platforms

**Platforms** are applications that:

- Display and interact with user data
- Sync data to/from user eVaults
- Convert between local and global data schemas
- Handle webhooks to receive data updates

## Data Flow

When a user creates data on a platform:

```
User Action → Platform Database → Web3 Adapter → User's eVault → Webhooks → All Platforms
```

1. **User Action**: User creates a post, message, or other data
2. **Platform Database**: Platform stores data locally
3. **Web3 Adapter**: Adapter converts data to global schema and syncs to eVault
4. **User's eVault**: eVault stores the data as a MetaEnvelope
5. **Webhooks**: eVault sends webhooks to all registered platforms (except the originating one)
6. **All Platforms**: Other platforms receive webhooks and create the data locally

## Next Steps

- Learn more about [W3DS Basics](/docs/W3DS%20Basics/getting-started) - Deep dive into eVault ownership and data flow
- Understand [Authentication](/docs/W3DS%20Protocol/Authentication) - How users authenticate with platforms
- Learn about [Signing](/docs/W3DS%20Protocol/Signing) - Signature creation and verification
- Explore [Signature Formats](/docs/W3DS%20Protocol/Signature-Formats) - Technical details on cryptographic signatures
- Build a platform with the [Post Platform Guide](/docs/Post%20Platform%20Guide/getting-started) - Step-by-step guide to creating a W3DS-compatible platform
