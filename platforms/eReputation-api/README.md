# eReputation API

This is the API server for the eReputation platform, implementing authentication and web3 integration similar to the dreamSync platform.

## Features

-   **Authentication**: JWT-based authentication with eVault integration
-   **User Management**: User profiles, search, and updates
-   **Group Management**: Group creation and management
-   **Web3 Integration**: Web3 adapter for blockchain integration
-   **Webhook Support**: Handles webhooks from eVault for user and group updates

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables in `.env` (in project root):

```env
# Database
EREPUTATION_DATABASE_URL=postgresql://username:password@localhost:5432/ereputation

# JWT
JWT_SECRET=your-secret-key

# Web3 Adapter
EREPUTATION_MAPPING_DB_PATH=./ereputation-mapping.db
PUBLIC_REGISTRY_URL=http://localhost:3000
VITE_EREPUTATION_BASE_URL=http://localhost:8765

# Optional: ANCHR forwarding
ANCHR_URL=http://localhost:3001

# Optional: Server port
PORT=8765
NODE_ENV=development
```

3. Run the development server:

```bash
npm run dev
```

## API Endpoints

### Authentication

-   `GET /api/auth/offer` - Get authentication offer
-   `POST /api/auth` - Login with eVault credentials
-   `GET /api/auth/sessions/:id` - SSE stream for auth sessions

### Users

-   `GET /api/users/me` - Get current user profile
-   `GET /api/users/search?q=query` - Search users
-   `GET /api/users/:id` - Get user profile by ID
-   `PATCH /api/users` - Update current user profile

### Webhooks

-   `POST /api/webhook` - Handle eVault webhooks

### Health

-   `GET /api/health` - Health check endpoint

## Architecture

The API follows the same patterns as dreamSync:

1. **Entities**: User and Group models with TypeORM
2. **Services**: Business logic for users and groups
3. **Controllers**: HTTP request handlers
4. **Middleware**: Authentication and authorization
5. **Web3 Adapter**: Integration with blockchain/web3 systems
6. **Webhooks**: Handle external updates from eVault

## Database

Uses PostgreSQL with TypeORM for data persistence. The database schema includes:

-   `users` table with profile information
-   `groups` table for group management
-   Junction tables for relationships (followers, group members, etc.)

## Web3 Integration

Integrates with the web3-adapter infrastructure to:

-   Sync user data with eVault
-   Handle group updates
-   Process webhook events from the blockchain
