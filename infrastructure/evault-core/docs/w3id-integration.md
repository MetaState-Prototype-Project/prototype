# W3ID Integration Documentation

## Overview

The eVault Core system integrates with W3ID (Web3 Identity) to provide decentralized identity verification and signature capabilities. This document outlines the technical implementation and functional aspects of the W3ID integration.

## Technical Architecture

### Components

1. **W3ID Client**

   - Uses the `w3id` package for identity verification
   - Handles JWT token validation and signature verification
   - Manages identity claims and verification status

2. **HTTP Endpoints**

   - Fastify-based REST API
   - Swagger documentation available at `/docs`
   - GraphQL integration for complex queries

3. **Signature System**
   - Decentralized signature verification
   - Log-based signature tracking
   - Multi-party signature support

## API Endpoints

### Identity Verification

#### GET /whois

Returns W3ID identity information and associated logs.

**Request:**

```http
GET /whois
Authorization: Bearer <jwt_token>
```

**Response:**

```json
{
  "w3id": {
    "did": "did:example:123",
    "verificationStatus": "verified",
    "claims": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "logs": [
    {
      "timestamp": "2024-03-20T12:00:00Z",
      "action": "identity_verification",
      "status": "success"
    }
  ]
}
```

### Signature Management

#### POST /watchers/sign

Submit a signature for a specific log entry.

**Request:**

```http
POST /watchers/sign
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "w3id": "did:example:123",
  "signature": "0x1234...",
  "logEntryId": "log_123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Signature stored successfully"
}
```

#### POST /watchers/request

Request a signature for a log entry.

**Request:**

```http
POST /watchers/request
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "w3id": "did:example:123",
  "logEntryId": "log_123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Signature request created",
  "requestId": "req_1234567890"
}
```

## Functional Documentation

### Identity Verification Flow

1. **Initial Verification**

   - User presents W3ID JWT token
   - System validates token and extracts identity claims
   - Identity status is logged in the system

2. **Signature Request Process**

   - User requests signature for a log entry
   - System verifies user's identity and permissions
   - Signature request is created and tracked

3. **Signature Submission**
   - User submits signature for requested log entry
   - System validates signature against W3ID
   - Signature is recorded in the log

### Security Considerations

1. **Token Validation**

   - All endpoints require valid W3ID JWT tokens
   - Token expiration is enforced
   - Token claims are verified against system requirements

2. **Signature Security**

   - Signatures are cryptographically verified
   - Each signature is tied to a specific identity
   - Signature requests are tracked and validated

3. **Log Integrity**
   - All actions are logged with timestamps
   - Log entries are immutable once signed
   - Multi-party verification is supported

## Integration Guide

### Prerequisites

1. W3ID JWT token generation
2. Access to the eVault Core system
3. Proper permissions for signature operations

### Implementation Steps

1. **Identity Setup**

   ```typescript
   import { W3ID } from "w3id";

   const w3id = new W3ID({
     // Configuration options
   });
   ```

2. **Token Generation**

   ```typescript
   const token = await w3id.generateToken({
     claims: {
       // Identity claims
     },
   });
   ```

3. **API Integration**
   ```typescript
   // Example API call with W3ID token
   const response = await fetch("/whois", {
     headers: {
       Authorization: `Bearer ${token}`,
     },
   });
   ```

## Error Handling

### Common Error Responses

1. **Invalid Token**

   ```json
   {
     "error": "invalid_token",
     "message": "Invalid or expired W3ID token"
   }
   ```

2. **Invalid Signature**

   ```json
   {
     "error": "invalid_signature",
     "message": "Signature verification failed"
   }
   ```

3. **Permission Denied**
   ```json
   {
     "error": "permission_denied",
     "message": "Insufficient permissions for operation"
   }
   ```

## Monitoring and Logging

### Log Structure

```typescript
interface LogEntry {
  timestamp: string;
  action:
    | "identity_verification"
    | "signature_request"
    | "signature_submission";
  status: "success" | "failure";
  details: {
    w3id: string;
    logEntryId?: string;
    signature?: string;
    error?: string;
  };
}
```

### Monitoring Endpoints

1. **Identity Status**

   - Track verification attempts
   - Monitor token usage
   - Audit identity changes

2. **Signature Tracking**
   - Monitor signature requests
   - Track signature submissions
   - Audit signature verification

## Best Practices

1. **Token Management**

   - Rotate tokens regularly
   - Use appropriate token scopes
   - Implement proper token storage

2. **Signature Handling**

   - Validate signatures immediately
   - Maintain signature audit trail
   - Implement proper error handling

3. **Security**
   - Use HTTPS for all communications
   - Implement rate limiting
   - Monitor for suspicious activity

## Troubleshooting

### Common Issues

1. **Token Validation Failures**

   - Check token expiration
   - Verify token claims
   - Ensure proper token format

2. **Signature Verification Issues**

   - Verify signature format
   - Check identity permissions
   - Validate log entry existence

3. **API Integration Problems**
   - Verify endpoint URLs
   - Check request headers
   - Validate response format
