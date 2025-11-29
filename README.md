# MetaState Prototype

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
- **8080** - Blabsy Frontend
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

Start all services:
```bash
pnpm dev:docker:all
```

Start specific profile:
```bash
pnpm dev:docker:socials
pnpm dev:docker:charter-blabsy
```

Or use docker compose directly:
```bash
docker compose -f dev-docker-compose.yaml --profile socials up --watch
docker compose -f dev-docker-compose.yaml --profile charter-blabsy up --watch
```

## Project Structure

```
prototype/
├─ infrastructure/
│  ├─ evault-core/
│  ├─ w3id/
│  └─ web3-adapter/
├─ platforms/
│  ├─ registry/
│  ├─ pictique-api/
│  ├─ pictique/
│  ├─ blabsy-w3ds-auth-api/
│  ├─ blabsy/
│  ├─ group-charter-manager-api/
│  ├─ group-charter-manager/
│  ├─ evoting-api/
│  ├─ eVoting/
│  ├─ dreamsync-api/
│  ├─ cerberus/
│  ├─ ereputation/
│  └─ marketplace/
├─ docker/
│  └─ Dockerfile.* (Dedicated Dockerfiles for each service)
└─ dev-docker-compose.yaml (Docker Compose configuration)
```
