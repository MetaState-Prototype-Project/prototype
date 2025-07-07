# Authentication Security Changes

## Overview
This document outlines the security changes made to prevent automatic user creation when users sign in but don't exist in the database.

## Problem
Previously, when a user signed in with a custom token or Google authentication, if they didn't exist in the database, the system would automatically create a new user record. This was a security vulnerability as it allowed unauthorized users to create accounts.

## Solution
The following changes were implemented to prevent automatic user creation:

### 1. Frontend Authentication Context (`src/lib/context/auth-context.tsx`)
- **Modified `manageUser` function**: Removed automatic user creation logic
- **Added error handling**: When a user doesn't exist in the database, an error is set and the user is signed out
- **Cleaned up imports**: Removed unused imports related to user creation

### 2. Authentication Layout (`src/components/layout/auth-layout.tsx`)
- **Added error display**: Shows authentication errors to users with a clear message
- **Added retry functionality**: Users can retry authentication if needed
- **Improved UX**: Clear messaging about contacting support for account registration

### 3. Firestore Security Rules (`firestore.rules`)
- **Restricted user creation**: Only admin users can create new user documents
- **Maintained read access**: Authenticated users can still read user data
- **Controlled updates**: Users can only update their own data or admin can update any user

## User Experience
When a user tries to sign in but doesn't exist in the database:

1. They will see an error message: "User not found in database. Please contact support to register your account."
2. They will be automatically signed out
3. They can retry authentication or contact support
4. No new user record is created

## Admin User Creation
Only users with admin privileges (username: 'ccrsxx') can create new user records. This ensures that user creation is controlled and audited.

## Backend Considerations
The webhook controller in `blabsy-w3ds-auth-api` can still create users through webhooks, but this is controlled by the external system and not by user authentication attempts.

## Testing
To test this fix:
1. Try to sign in with a custom token for a user that doesn't exist in the database
2. Verify that no new user record is created
3. Verify that an appropriate error message is displayed
4. Verify that the user is signed out automatically 