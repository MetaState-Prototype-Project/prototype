# Search Engine Service

A service that queries the registry and eVault to provide search functionality across registry entries and user profiles.

## Features

- **Registry Data Caching**: Queries the registry's `/list` endpoint and caches all vault entries
- **User Profile Caching**: Queries eVault for user profiles using the User schema (ID: `550e8400-e29b-41d4-a716-446655440000`)
- **Automatic Refresh**: Runs a cron job every 15 minutes to refresh cached data
- **Multi-field Search**: Search by name, ename, w3id, username, displayName, bio, location, website, etc.
- **Combined Search**: Search across both registry entries and user profiles simultaneously

## Configuration

Set the following environment variables:

```bash
PORT=3002                                    # Service port (default: 3002)
REGISTRY_URL=http://localhost:4321          # Registry service URL
EVAULT_BASE_URL=http://localhost:4000       # eVault service URL
```

## API Endpoints

### Health Check

```
GET /health
```

Returns service status and cache statistics.

### Search Registry Entries

```
GET /search/registry?q=<query>&type=<search_type>
```

Search registry entries by query and optional type filter.

**Parameters:**

- `q` (required): Search query
- `type` (optional): Search type (`ename`, `w3id`, `uri`, `evault`, or `all`)

### Search User Profiles

```
GET /search/users?q=<query>&type=<search_type>
```

Search user profiles by query and optional type filter.

**Parameters:**

- `q` (required): Search query
- `type` (optional): Search type (`username`, `displayName`, `bio`, `location`, `website`, or `all`)

### Combined Search

```
GET /search?q=<query>&type=<search_type>
```

Search both registry entries and user profiles simultaneously.

### Cache Statistics

```
GET /cache/stats
```

Returns current cache statistics.

### Manual Refresh

```
POST /refresh
```

Manually trigger a cache refresh.

## Installation

```bash
cd services/search-engine
npm install
```

## Development

```bash
npm run dev
```

## Production

```bash
npm start
```

## Data Flow

1. **Initial Load**: Service starts and immediately fetches data from registry and eVault
2. **Scheduled Refresh**: Every 15 minutes, the service refreshes all cached data
3. **Search Queries**: Users can search cached data instantly without hitting external services
4. **Manual Refresh**: Admins can trigger immediate cache refresh via API

## User Profile Schema

The service queries user profiles using the User schema with ID `550e8400-e29b-41d4-a716-446655440000`. Searchable fields include:

- `username`: User's unique username/handle
- `displayName`: User's display name or full name
- `bio`: User's biography or description
- `location`: User's physical location
- `website`: User's personal website URL
- `avatarUrl`: URL to user's profile picture
- `bannerUrl`: URL to user's profile banner
- `isVerified`: Whether the user's account is verified
- `isPrivate`: Whether the user's account is private
- `followerCount`: Number of followers
- `followingCount`: Number of users followed
- `postCount`: Number of posts created

## Registry Entry Structure

Registry entries contain:

- `ename`: W3ID identifier
- `uri`: Service URI
- `evault`: eVault identifier

## Error Handling

The service gracefully handles:

- Network timeouts
- Service unavailability
- Invalid responses
- Partial data failures

Failed queries are logged but don't crash the service, ensuring high availability.
