---
sidebar_position: 1
---

# Local Dev Quick Start

Run **Postgres** and **Neo4j** in Docker, then start the core services (Registry, eVault Core) and the dev sandbox with one script.

:::info Deploying on a server?
This page sets up a **local development** stack on `localhost`, with its own Registry and dev servers that run in the foreground. To run an eVault on a server that other people reach over HTTPS, connected to the shared W3DS Registry, follow [Self-hosting an eVault](/docs/Infrastructure/self-hosting-evault) instead.
:::

## Prerequisites

- **Git**
- **Docker** (for Postgres and Neo4j)
- **Node.js 18+** and **pnpm** (`corepack enable` installs the pinned pnpm version)

## 1. Clone and install

```bash
git clone https://github.com/MetaState-Prototype-Project/prototype.git
cd prototype
pnpm install
```

Run `pnpm install` before the other `pnpm` commands below. `pnpm generate-entropy-jwk` and the `dev:core` scripts depend on it.

## 2. Environment

Create `.env` in the repo root from the example:

```bash
cp .env.example .env
```

`.env.example` covers every platform in the repo. For this stack, check that `.env` contains at least the following, and add any lines that are missing:

```bash
# Postgres (used by registry and evault-core)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
REGISTRY_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/registry

# Registry: ES256 key for signing entropy tokens (required; generate below)
REGISTRY_ENTROPY_KEY_JWK='<paste generated JWK here>'

# Neo4j (used by evault-core)
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# So the sandbox and evault-core can talk to registry/provisioner
PUBLIC_REGISTRY_URL=http://localhost:4321
PUBLIC_PROVISIONER_URL=http://localhost:3001
REGISTRY_SHARED_SECRET=dev-secret-change-me
PUBLIC_EVAULT_SERVER_URI=http://localhost:4000

# Provisioner signing key: any 64 hex chars (openssl rand -hex 32)
PROVISIONER_SIGNING_SEED=<64 hex chars>
```

`POSTGRES_USER` and `POSTGRES_PASSWORD` are optional and default to `postgres`/`postgres`. If you change them, change the user and password inside `REGISTRY_DATABASE_URL` too.

### Generating `REGISTRY_ENTROPY_KEY_JWK`

The Registry signs entropy tokens (used by the eID Wallet and provisioning) with an ES256 key. You must set `REGISTRY_ENTROPY_KEY_JWK` to a JSON Web Key (private key). From the repo root, after `pnpm install`, generate a JWK (printed to stdout):

```bash
pnpm generate-entropy-jwk
```

Put the output in `.env` as `REGISTRY_ENTROPY_KEY_JWK='<paste>'`. Keep the key private. Use the same value across local dev if tokens need to verify elsewhere.

## 3. One-command start

From the repo root:

```bash
pnpm dev:core
```

Or run one step at a time:

```bash
pnpm dev:core:docker
pnpm dev:core:wait
pnpm dev:core:migrate
pnpm dev:core:apps
```

- `dev:core:docker`: starts Postgres and Neo4j in Docker
- `dev:core:wait`: waits for ports `5432` and `7687`
- `dev:core:migrate`: runs registry + evault-core migrations
- `dev:core:apps`: starts registry, evault-core, and dev-sandbox together

This will:

1. Start **Postgres** (port 5432) and **Neo4j** (7474, 7687) via `docker-compose.databases.yml`
2. Wait for Postgres to be ready
3. Start **registry** (4321), **evault-core** (3001 provisioning, 4000 GraphQL), and **dev-sandbox** (8080) in parallel

Stop with `Ctrl+C`. To stop only the databases:

```bash
pnpm docker:core:down
```

## Ports

| Service         | Port(s)    | Notes                    |
|-----------------|------------|--------------------------|
| Postgres        | 5432       |                          |
| Neo4j HTTP      | 7474       |                          |
| Neo4j Bolt      | 7687       |                          |
| Registry        | 4321       |                          |
| evault-core     | 3001, 4000 | Provisioning + GraphQL   |
| **Dev sandbox** | **8080**   | W3DS dev sandbox UI      |

Open **http://localhost:8080** for the dev sandbox (provision, W3DS flows, sign).

## Optional: databases only

To run only Postgres and Neo4j (e.g. you run the app services yourself):

```bash
pnpm docker:core
```

Or:

```bash
docker compose -f docker-compose.databases.yml up -d
```

Stop with:

```bash
pnpm docker:core:down
```

## Troubleshooting

**Neo4j "encryption setting" or connection refused:** The stack uses **Neo4j 4.4** (unencrypted Bolt by default). If you previously used Neo4j 5.x, remove the old data and recreate:

```bash
docker compose -f docker-compose.databases.yml down
docker volume rm metastate_neo4j_data 2>/dev/null || true
docker compose -f docker-compose.databases.yml up -d
pnpm dev:core
```

Otherwise ensure `.env` has:

```bash
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
```

**Opening the stack from another machine:** the dev servers answer on `localhost` only, and Vite rejects requests for other host names. Don't work around this on a shared server. Use the Docker-based [Self-hosting an eVault](/docs/Infrastructure/self-hosting-evault) setup, which also covers HTTPS and running the Dev Sandbox as a production build.

For full Docker setups and all platform services, see the main `README` in the repo root.

