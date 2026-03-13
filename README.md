# MetaState Prototype

**[Documentation](https://docs.w3ds.metastate.foundation)** — Getting started with W3DS and the MetaState prototype.

**Quick start (registry + evault-core + dev-sandbox):** see **[QUICKSTART.md](QUICKSTART.md)** — one script to run Postgres + Neo4j in Docker and the core services locally. Dev sandbox runs at **http://localhost:8080**.

## Docker Development Environment

### Port Assignments

#### Core Services (Always Running)

- **4321** - Registry Service
- **3001** - evault-core Provisioning API (Express)
- **4000** - evault-core GraphQL/HTTP API (Fastify)
- **5432** - PostgreSQL Database
- **7474** - Neo4j HTTP Interface
- **7687** - Neo4j Bolt Protocol

#### Platform APIs

- **3000** - Blabsy W3DS Auth API
- **3002** - Cerberus API
- **3003** - Group Charter Manager API
- **4001** - DreamSync API
- **4002** - eVoting API
- **4003** - Emover API
- **5000** - eReputation Service
- **5001** - Marketplace Service
- **1111** - Pictique API

#### Frontend Services

- **8080** - Dev sandbox (W3DS) / Blabsy Frontend
- **5173** - Pictique Frontend
- **3004** - Group Charter Manager Frontend
- **3005** - eVoting Frontend
- **3006** - Emover Frontend

### Docker Compose Profiles

#### `socials` Profile

Runs core services plus social media platforms:

- Core: registry, evault-core, postgres, neo4j
- Pictique API + Frontend
- Blabsy API + Frontend

#### `charter-blabsy` Profile

Runs core services plus charter and blabsy:

- Core: registry, evault-core, postgres, neo4j
- Group Charter Manager API + Frontend
- Blabsy API + Frontend
- Cerberus

#### `all` Profile

Runs all services (core + all APIs + all frontends)

### Usage

**Local dev (recommended):** `pnpm dev:core` — see [QUICKSTART.md](QUICKSTART.md). Runs Postgres + Neo4j in Docker, then registry, evault-core, and dev-sandbox locally.

**Databases only:** `pnpm docker:core` (Postgres + Neo4j). Stop with `pnpm docker:core:down`.

## Project Structure

```
prototype/
├─ infrastructure/
│  ├─ evault-core/
│  ├─ w3id/
│  └─ web3-adapter/
├─ platforms/
│  ├─ registry/
│  │  └─ api/
│  ├─ pictique/
│  │  ├─ api/
│  │  └─ client/
│  ├─ blabsy/
│  │  ├─ api/
│  │  └─ client/
│  ├─ group-charter-manager/
│  │  ├─ api/
│  │  └─ client/
│  ├─ evoting/
│  │  ├─ api/
│  │  └─ client/
│  ├─ dreamsync/
│  │  ├─ api/
│  │  └─ client/
│  ├─ cerberus/
│  │  └─ client/
│  ├─ ereputation/
│  │  ├─ api/
│  │  └─ client/
│  └─ marketplace/
│     └─ client/
├─ docker/
│  └─ Dockerfile.* (Dedicated Dockerfiles for each service)
└─ docker-compose.databases.yml (Postgres + Neo4j)
```
