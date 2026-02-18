# Quick start: registry + evault-core + dev-sandbox

Run Postgres and Neo4j in Docker, then start the core services and dev-sandbox with one script.

## Prerequisites

- **Docker** (for Postgres and Neo4j)
- **Node.js 18+** and **pnpm**
- **.env** in the repo root (copy from `.env.example` if present, or set the variables below)

## Environment

Create or edit `.env` in the repo root. Minimum for this stack:

```bash
# Postgres (used by registry)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
REGISTRY_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/registry

# Registry: ES256 key for signing entropy tokens (required; generate once —  pnpm generate-entropy-jwk)
REGISTRY_ENTROPY_KEY_JWK='<paste generated JWK here>'

# Neo4j (used by evault-core)
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# So the sandbox and evault-core can talk to registry/provisioner
PUBLIC_REGISTRY_URL=http://localhost:4321
PUBLIC_PROVISIONER_URL=http://localhost:3001
REGISTRY_SHARED_SECRET=dev-secret-change-me
PUBLIC_EVAULT_SERVER_URI=http://localhost:4000
```

### Generating `REGISTRY_ENTROPY_KEY_JWK`

The Registry signs entropy tokens (used by the eID Wallet and provisioning) with an ES256 key. You must set `REGISTRY_ENTROPY_KEY_JWK` to a JSON Web Key (private key). From the repo root, generate a JWK (output to stdout) and add it to `.env`:

```bash
pnpm generate-entropy-jwk
```

Put the output in `.env` as `REGISTRY_ENTROPY_KEY_JWK='<paste>'`. Keep the key private; use the same value across local dev if you need tokens to verify elsewhere.

## One-command start

From the repo root:

```bash
pnpm install
pnpm dev:core
```

Or run steps individually:

```bash
pnpm dev:core:docker
pnpm dev:core:wait
pnpm dev:core:migrate
pnpm dev:core:apps
```

This will:

1. Start **Postgres** (port 5432) and **Neo4j** (7474, 7687) via `docker-compose.databases.yml`
2. Wait for Postgres to be ready
3. Start **registry** (4321), **evault-core** (3001 provisioning, 4000 GraphQL), and **dev-sandbox** (8080) in parallel

Stop with `Ctrl+C`. To stop only the databases: `pnpm docker:core:down`.

## Ports

| Service        | Port(s) | Notes                    |
|----------------|---------|--------------------------|
| Postgres       | 5432    |                          |
| Neo4j HTTP     | 7474    |                          |
| Neo4j Bolt     | 7687    |                          |
| Registry       | 4321    |                          |
| evault-core    | 3001, 4000 | Provisioning + GraphQL |
| **Dev sandbox**| **8080**| W3DS dev sandbox UI      |

Open **http://localhost:8080** for the dev sandbox (provision, w3ds flows, sign).

## Optional: databases only

To run only Postgres and Neo4j (e.g. you run the app services yourself):

```bash
pnpm docker:core
```

Or: `docker compose -f docker-compose.databases.yml up -d`. Stop with `pnpm docker:core:down`.

## Troubleshooting

**Neo4j "encryption setting" or connection refused:** The stack uses **Neo4j 4.4** (unencrypted Bolt by default). If you previously used Neo4j 5.x, remove the old data and recreate:

```bash
docker compose -f docker-compose.databases.yml down
docker volume rm metastate_neo4j_data 2>/dev/null || true
docker compose -f docker-compose.databases.yml up -d
pnpm dev:core
```

Otherwise ensure `.env` has `NEO4J_URI=bolt://127.0.0.1:7687` and matching `NEO4J_USER` / `NEO4J_PASSWORD`.

---

For full Docker setups and all platform services, see the main [README](README.md).
