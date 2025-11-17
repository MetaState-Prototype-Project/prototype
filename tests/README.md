# Staging Load Tests

This directory contains staging load tests for the W3DS sync system. These tests run against already hosted code to simulate real-world load and verify bidirectional sync between blabsy and pictique platforms.

## Overview

The test suite simulates configurable concurrent users (default: 2, can be scaled up to 50+) performing various operations across both platforms, verifying that data syncs correctly between:
- **blabsy** (Firebase-based social platform)
- **pictique** (API-based social platform)

## Test Coverage

The suite tests sync for:
- **Users**: Profile updates (name, bio, avatar, location, website)
- **Posts/Tweets**: Content creation and updates
- **Comments/Replies**: Threaded discussions
- **Likes**: Engagement actions
- **Messages**: Direct messaging
- **Chats/Groups**: Group conversations

## Setup

1. Install dependencies:
```bash
cd staging-load-tests
npm install
```

2. Ensure environment variables are set in the root `.env` file:
   - `PUBLIC_PICTIQUE_BASE_URL` - Base URL for pictique API (required)
   - `PUBLIC_BLABSY_BASE_URL` - Base URL for blabsy API (required)
   - `PUBLIC_REGISTRY_URL` - Base URL for registry service (required for eName provisioning)
   - `PUBLIC_PROVISIONER_URL` - Base URL for evault-core provisioning service (required for eName provisioning)
   - `GOOGLE_APPLICATION_CREDENTIALS` - Path to Firebase Admin credentials JSON file (relative to project root)
   - `FIREBASE_PROJECT_ID` - Firebase project ID (optional)
   - `JWT_SECRET` - JWT secret for pictique API (optional, defaults to 'your-secret-key')
   - `DEMO_CODE_W3DS` - Demo code for W3DS verification (optional, defaults to 'd66b7138-538a-465f-a6ce-f6985854c3f4')
   - `LOAD_TEST_USER_COUNT` - Number of users for concurrent load test (optional, defaults to 2)
   - `CLEAR_USER_CACHE` - Set to `true` to force recreation of test users (optional, defaults to false - uses cache)

## Running Tests

### Run all tests
```bash
npm test
# or from root:
npm run test:staging-load
```

### Run in watch mode
```bash
npm run test:watch
# or from root:
npm run test:staging-load:watch
```

### Run specific test file
```bash
npm test -- user-sync.test.ts
npm test -- concurrent-load.test.ts
```

### Run with UI (interactive)
```bash
npm run test:ui
```

## Test Framework

This test suite uses **Vitest** for better real-time status reporting and faster execution. Vitest provides:
- Real-time test status updates
- Better progress indicators for long-running tests
- Faster execution compared to Jest
- Native TypeScript support

## Test Structure

- `src/config/` - Configuration and environment setup
- `src/utils/` - Utility functions for Firebase, API clients, user factory, and sync verification
- `src/scenarios/` - Individual test scenarios for each entity type
- `src/load/` - Main load test orchestrator with configurable concurrent users (default: 2, set via `LOAD_TEST_USER_COUNT`)

## User Personas

The load test simulates different user behavior patterns:
- **Content Creator**: Creates many posts/tweets, some comments, few likes
- **Commenter**: Creates few posts, many comments, moderate likes
- **Liker**: Creates very few posts, few comments, many likes
- **Messenger**: Focuses on messaging and chat interactions
- **Balanced**: Balanced activity across all types

## Sync Timing

- Expected sync time: ~15 seconds
- Test buffer time: 30 seconds
- Prevention window: 15 seconds (entities updated within this window won't update again)

## User Creation Process

Test users are created using the following process:

1. **eName Provisioning**: Each user's eName is provisioned via evault-core:
   - Gets entropy token from `PUBLIC_REGISTRY_URL/entropy` endpoint
   - Uses a random UUID as the namespace
   - Provisions eName via evault-core `/provision` endpoint
   - Returns the provisioned w3id (eName) in `@` format

2. **Firebase User Creation**: 
   - Creates user in Firebase Auth using the provisioned eName as the UID
   - Creates user document in Firestore with the eName
   - Username is set to the eName without the `@` prefix
   - Users automatically sync to pictique (no API calls needed)

**Important**: Users are NEVER created through pictique-api. All users are created in Firebase first, and sync happens automatically.

## User Caching

Test users are automatically cached to avoid recreation on each test run:
- Users are saved to `.test-users-cache.json` after creation
- Subsequent test runs will reuse cached users if available
- Cache is validated to ensure it has enough users for the requested count
- To force recreation, set `CLEAR_USER_CACHE=true` environment variable
- Cache file is gitignored and should not be committed

## Performance Optimizations

- **User Creation**: Users are created in parallel batches (5 at a time) for faster setup
- **Parallel Execution**: After initial user setup, all user activities run in parallel
- **Caching**: User data is cached to skip recreation on subsequent runs
- **Token Caching**: Auth tokens are obtained in parallel for all users

## Notes

- Tests create real users in Firebase, which will automatically sync to pictique
- Users are NOT deleted after tests (deletion is not supported for sync)
- After initial setup, all user activities run in parallel for maximum load simulation
- Each user performs multiple operations with realistic delays between actions
- eName provisioning happens before each user is created in Firebase

