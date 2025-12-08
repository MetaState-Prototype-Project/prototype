# Emover API

Backend API for the emover platform that handles evault migration operations.

## Features

- Secure authentication via eID Wallet (QR code + SSE)
- View current evault host/provider information
- List available provisioners
- Initiate and manage evault migrations
- QR code signing for migration confirmation
- Real-time migration progress via SSE
- Comprehensive logging at every step

## Environment Variables

- `PORT` - Server port (default: 4003)
- `PUBLIC_EMOVER_BASE_URL` - API base URL for authentication redirects (default: http://localhost:4003)
- `PUBLIC_REGISTRY_URL` - Registry service URL
- `PROVISIONER_URL` or `PROVISIONER_URLS` - Provisioner URL(s)
- `EVAULT_BASE_URI` - Base URI for evault instances
- `EMOVER_DATABASE_URL` or `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `REGISTRY_SHARED_SECRET` - Secret for registry API authentication
- `NEO4J_USER` - Neo4j username (for cross-evault operations)
- `NEO4J_PASSWORD` - Neo4j password (for cross-evault operations)
- `DEMO_VERIFICATION_CODE` - Demo verification code for provisioning

## API Endpoints

### Authentication
- `GET /api/auth/offer` - Get QR code for login
- `POST /api/auth` - Handle eID Wallet callback
- `GET /api/auth/sessions/:id` - SSE stream for auth status

### User
- `GET /api/users/me` - Get current user (protected)

### Evault Info
- `GET /api/evault/current` - Get current evault info (protected)
- `GET /api/provisioners` - List available provisioners (protected)

### Migration
- `POST /api/migration/initiate` - Start migration (protected)
- `POST /api/migration/sign` - Create signing session (protected)
- `GET /api/migration/sessions/:id` - SSE stream for migration status
- `POST /api/migration/callback` - Handle signed payload from eID Wallet
- `GET /api/migration/status/:id` - Get migration status
- `POST /api/migration/delete-old` - Delete old evault (protected)

## Migration Flow

1. User initiates migration with selected provisioner
2. System provisions new evault instance
3. **Copies all metaEnvelopes to new evault** (preserving IDs and eName)
4. **Verifies copy** (count, IDs, integrity)
5. **Updates registry mapping** (only after successful verification)
6. **Verifies registry update**
7. **Marks new evault as active**
8. **Verifies new evault is working**
9. **Deletes old evault** (only after all above steps succeed)

## Database

Uses PostgreSQL with TypeORM. Run migrations:

```bash
npm run migration:run
```

## Development

```bash
npm install
npm run dev
```

