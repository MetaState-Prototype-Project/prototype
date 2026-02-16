# DreamSync API

A REST API for the DreamSync platform, cloned from evoting-api with focus on user management, groups, and messaging functionality.

## Features

- **User Management**: User profiles, authentication, and user search
- **Group Management**: Group creation, membership, and administration
- **Messaging**: Group messaging with system message support
- **Web3 Integration**: Web3Adapter integration for decentralized data synchronization
- **Authentication**: JWT-based authentication with better-auth integration

## Database Schema

The API uses PostgreSQL with TypeORM and includes the following entities:

- **User**: User profiles with followers/following relationships
- **Group**: Groups with members, admins, and participants
- **Message**: Messages within groups, including system messages

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database
DREAMSYNC_DATABASE_URL=postgresql://username:password@localhost:5432/dreamsync_db

# Web3Adapter
DREAMSYNC_MAPPING_DB_PATH=/path/to/mapping/database
PUBLIC_REGISTRY_URL=https://your-registry-url.com
PUBLIC_DREAMSYNC_BASE_URL=https://your-dreamsync-url.com

# Authentication
JWT_SECRET=your-jwt-secret-key
DREAMSYNC_CLIENT_URL=http://localhost:3000

# Server
PORT=4001
NODE_ENV=development
```

## Installation

1. Install dependencies:

```bash
npm install
```

2. Set up your environment variables in `.env`

3. Run database migrations:

```bash
npm run migration:run
```

## Development

Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:4001`

## API Endpoints

### User Endpoints

- `GET /api/users/me` - Get current user profile (requires auth)
- `GET /api/users/search?q=query` - Search users
- `GET /api/users/:id` - Get user profile by ID (requires auth)
- `PATCH /api/users` - Update current user profile (requires auth)

### Health Check

- `GET /api/health` - Check API health status

## Database Reset

To reset the database and run migrations:

```bash
./reset.sh
```

## Web3Adapter Integration

The API includes Web3Adapter integration for:

- User data synchronization
- Message synchronization (system messages only)
- Group data synchronization

## Differences from evoting-api

This API is a simplified version of evoting-api that focuses on:

- User management and profiles
- Group functionality
- Basic messaging
- Web3Adapter integration for users and messages

Poll and voting functionality has been removed to focus on core social features.
