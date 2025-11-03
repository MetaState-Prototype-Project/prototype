# Dev Docker Compose

This docker-compose file sets up the development environment for the Metastate project.

## Core Services (Always Running)

- **registry** - Runs on port 4321
- **evault-core** - Runs on ports 3001 (Express/Provisioning) and 4000 (Fastify/GraphQL)
- **neo4j** - Runs on ports 7474 (HTTP) and 7687 (Bolt) for graph data storage
- **postgres** - Runs on port 5432 with multiple databases pre-created

## Optional Platform Services

Use Docker Compose profiles to enable optional platforms:

### Available Profiles

- `pictique` - Pictique API (port 1111)
- `evoting` - eVoting API (port 4000)
- `dreamsync` - DreamSync API (port 4001)
- `cerberus` - Cerberus (port 3002)
- `group-charter` - Group Charter Manager API (port 3003)
- `blabsy` - Blabsy W3DS Auth API (port 3000)
- `ereputation` - eReputation (port 5000)
- `marketplace` - Marketplace (port 5001)
- `all` - Enable all optional platforms at once

## Usage

### Start core services only:
```bash
docker compose -f dev-docker-compose.yaml up
```

### Start with specific platforms:
```bash
# Single platform
docker compose -f dev-docker-compose.yaml --profile pictique up

# Multiple platforms
docker compose -f dev-docker-compose.yaml --profile pictique --profile evoting up

# All platforms
docker compose -f dev-docker-compose.yaml --profile all up
```

### Background mode:
```bash
docker compose -f dev-docker-compose.yaml --profile pictique up -d
```

### Stop services:
```bash
docker compose -f dev-docker-compose.yaml down
```

### View logs:
```bash
# All services
docker compose -f dev-docker-compose.yaml logs -f

# Specific service
docker compose -f dev-docker-compose.yaml logs -f registry
```

## Environment Variables

Create a `.env` file in the project root with your configuration:

```env
# Registry
REGISTRY_SHARED_SECRET=your-secret-here
PUBLIC_REGISTRY_URL=http://localhost:4321

# Database URLs (optional - defaults are provided)
REGISTRY_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/registry
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j
```

## Notes

- All services mount the source code for hot-reload development
- Node modules are stored in Docker volumes to avoid host conflicts
- PostgreSQL automatically creates all required databases on first startup
- Services wait for database health checks before starting


