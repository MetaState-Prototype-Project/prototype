# Search Engine Service Usage Examples

## Basic Usage

### Health Check
```bash
curl http://localhost:3002/health
```

### Search Registry by W3ID
```bash
curl "http://localhost:3002/search/registry?q=user123&type=w3id"
```

### Search Users by Username
```bash
curl "http://localhost:3002/search/users?q=john&type=username"
```

### Search Users by Display Name
```bash
curl "http://localhost:3002/search/users?q=John Doe&type=displayName"
```

### Search Users by Bio
```bash
curl "http://localhost:3002/search/users?q=developer&type=bio"
```

### Search Users by Location
```bash
curl "http://localhost:3002/search/users?q=San Francisco&type=location"
```

### Combined Search (Registry + Users)
```bash
curl "http://localhost:3002/search?q=test"
```

### Get Cache Statistics
```bash
curl http://localhost:3002/cache/stats
```

### Manual Cache Refresh
```bash
curl -X POST http://localhost:3002/refresh
```

## JavaScript/Node.js Examples

### Using axios
```javascript
const axios = require('axios');

// Search for users
async function searchUsers(query) {
    const response = await axios.get(`http://localhost:3002/search/users?q=${query}`);
    return response.data;
}

// Search registry
async function searchRegistry(query) {
    const response = await axios.get(`http://localhost:3002/search/registry?q=${query}`);
    return response.data;
}

// Combined search
async function searchAll(query) {
    const response = await axios.get(`http://localhost:3002/search?q=${query}`);
    return response.data;
}

// Usage
searchUsers('john').then(console.log);
searchRegistry('user123').then(console.log);
searchAll('test').then(console.log);
```

### Using fetch (Browser)
```javascript
// Search for users
async function searchUsers(query) {
    const response = await fetch(`http://localhost:3002/search/users?q=${query}`);
    return response.json();
}

// Search registry
async function searchRegistry(query) {
    const response = await fetch(`http://localhost:3002/search/registry?q=${query}`);
    return response.json();
}

// Combined search
async function searchAll(query) {
    const response = await fetch(`http://localhost:3002/search?q=${query}`);
    return response.json();
}

// Usage
searchUsers('john').then(console.log);
searchRegistry('user123').then(console.log);
searchAll('test').then(console.log);
```

## Response Formats

### Registry Search Response
```json
{
    "query": "user123",
    "type": "w3id",
    "count": 1,
    "results": [
        {
            "ename": "user123",
            "uri": "https://example.com/user123",
            "evault": "evault123"
        }
    ]
}
```

### User Search Response
```json
{
    "query": "john",
    "type": "username",
    "count": 1,
    "results": [
        {
            "id": "user-profile-id",
            "username": "john_doe",
            "displayName": "John Doe",
            "bio": "Software developer",
            "location": "San Francisco",
            "website": "https://johndoe.com",
            "avatarUrl": "https://example.com/avatar.jpg",
            "isVerified": true,
            "followerCount": 150,
            "followingCount": 75,
            "postCount": 42
        }
    ]
}
```

### Combined Search Response
```json
{
    "query": "test",
    "type": "all",
    "registry": {
        "count": 2,
        "results": [
            {
                "ename": "testuser",
                "uri": "https://example.com/testuser",
                "evault": "evault456"
            }
        ]
    },
    "users": {
        "count": 1,
        "results": [
            {
                "id": "user-profile-id",
                "username": "testuser",
                "displayName": "Test User",
                "bio": "Testing things"
            }
        ]
    }
}
```

## Search Types

### Registry Search Types
- `ename` - Search by ename/W3ID
- `w3id` - Alias for ename
- `uri` - Search by service URI
- `evault` - Search by eVault ID
- `all` - Search across all fields (default)

### User Search Types
- `username` - Search by username
- `displayName` - Search by display name
- `bio` - Search by biography
- `location` - Search by location
- `website` - Search by website URL
- `all` - Search across all fields (default) 