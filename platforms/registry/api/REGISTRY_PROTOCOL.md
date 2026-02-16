# Registry Service Protocol Specification

## Protocol Overview

The Registry Service Protocol defines a standardized interface for decentralized service discovery and cryptographic operations. It enables W3ID-based service resolution, entropy generation, and platform certification within a distributed identity ecosystem.

## Protocol Architecture

### Core Protocol Components

1. **Service Registry** - Centralized vault entry management
2. **Service Resolution** - W3ID-based service discovery
3. **Cryptographic Services** - Entropy generation and platform certification
4. **Key Discovery** - Public key distribution for verification

### Protocol Roles

- **Registry Provider**: Maintains the service registry and cryptographic services
- **Service Provider**: Registers their services with the registry
- **Client**: Resolves services and requests cryptographic operations
- **Platform**: Obtains certification tokens for integration

## Protocol Data Models

### Vault Entry

```json
{
    "ename": "string", // W3ID identifier for service discovery
    "uri": "string", // Service endpoint URI
    "evault": "string" // Evault identifier for service routing
}
```

### Entropy Token

```json
{
    "entropy": "string", // 20-character alphanumeric entropy
    "iat": "number", // Issued at timestamp
    "exp": "number" // Expiration timestamp (1 hour)
}
```

### Platform Token

```json
{
    "platform": "string", // Platform identifier
    "iat": "number", // Issued at timestamp
    "exp": "number" // Expiration timestamp (1 year)
}
```

### JWK Set

```json
{
    "keys": [
        {
            "kty": "EC",
            "crv": "P-256",
            "x": "string",
            "y": "string",
            "kid": "string",
            "alg": "ES256",
            "use": "sig"
        }
    ]
}
```

## Protocol Endpoints

### Authentication Protocol

Protected endpoints require authentication using a shared secret:

```
Authorization: Bearer <shared-secret>
```

### 1. Service Registration Protocol

**Method**: `POST /register`

**Authentication**: Required

**Request Protocol**:

```json
{
    "ename": "service.w3id",
    "uri": "https://service.example.com",
    "evault": "evault-identifier"
}
```

**Response Protocol**:

```json
{
    "id": "number",
    "ename": "service.w3id",
    "uri": "https://service.example.com",
    "evault": "evault-identifier"
}
```

**Protocol Errors**:

- `400`: Missing required fields
- `401`: Authentication failure
- `500`: Registration failure

### 2. Service Resolution Protocol

**Method**: `GET /resolve?w3id=<w3id>`

**Authentication**: None

**Protocol Flow**:

1. Client sends W3ID identifier
2. Registry resolves to service details
3. Returns service information or 404 if not found

**Response Protocol**:

```json
{
    "ename": "service.w3id",
    "uri": "https://service.example.com",
    "evault": "evault-identifier"
}
```

**Protocol Errors**:

- `400`: Missing W3ID parameter
- `404`: Service not found
- `500`: Resolution failure

### 3. Service Discovery Protocol

**Method**: `GET /list`

**Authentication**: None

**Protocol Purpose**: Retrieve all registered services for discovery

**Response Protocol**:

```json
[
    {
        "ename": "service1.w3id",
        "uri": "https://service1.example.com",
        "evault": "evault-1"
    }
]
```

### 4. Entropy Generation Protocol

**Method**: `GET /entropy`

**Authentication**: None

**Protocol Purpose**: Generate cryptographically secure entropy for client operations

**Response Protocol**:

```json
{
    "token": "jwt-token-containing-entropy"
}
```

**Token Payload Protocol**:

```json
{
    "entropy": "AbCdEfGhIjKlMnOpQrSt",
    "iat": 1640995200,
    "exp": 1640998800
}
```

### 5. Platform Certification Protocol

**Method**: `POST /platforms/certification`

**Authentication**: None

**Request Protocol**:

```json
{
    "platform": "platform-identifier"
}
```

**Response Protocol**:

```json
{
    "token": "jwt-token-containing-platform-certification"
}
```

**Token Payload Protocol**:

```json
{
    "platform": "platform-name",
    "iat": 1640995200,
    "exp": 1672531200
}
```

### 6. Platform Discovery Protocol

**Method**: `GET /platforms`

**Authentication**: None

**Protocol Purpose**: Discover available platforms in the ecosystem

**Response Protocol**:

```json
["https://platform1.example.com", "https://platform2.example.com"]
```

### 7. Key Discovery Protocol

**Method**: `GET /.well-known/jwks.json`

**Authentication**: None

**Protocol Purpose**: Standard JWK discovery for token verification

**Response Protocol**:

```json
{
    "keys": [
        {
            "kty": "EC",
            "crv": "P-256",
            "x": "base64url-encoded-x",
            "y": "base64url-encoded-y",
            "kid": "key-identifier",
            "alg": "ES256",
            "use": "sig"
        }
    ]
}
```

## Cryptographic Protocol

### Key Management Protocol

1. **Key Generation**: ES256 key pairs for token signing
2. **Key Storage**: Secure storage of private keys
3. **Key Rotation**: Support for multiple signing keys with identifiers
4. **Public Key Distribution**: JWK endpoint for public key discovery

### Token Protocol

1. **Entropy Tokens**: 20-character alphanumeric entropy, 1-hour expiration
2. **Platform Tokens**: Platform certification, 1-year expiration
3. **Signing Algorithm**: ES256 (ECDSA with P-256 curve and SHA-256)
4. **Token Headers**: Include algorithm and key identifier

### Security Protocol

1. **Private Key Protection**: Never expose private key components
2. **Token Expiration**: Appropriate expiration times for different use cases
3. **Key Rotation**: Support for multiple signing keys
4. **Cross-Origin Access**: Configured for distributed access

## Protocol Standards

### HTTP Protocol Compliance

- **Status Codes**: Standard HTTP status codes for responses
- **Headers**: Standard HTTP headers for authentication and CORS
- **Content Types**: JSON content type for all requests/responses

### JWT Protocol Compliance

- **RFC 7519**: Compliant JWT implementation
- **RFC 7517**: Standard JWK format
- **RFC 7518**: ES256 algorithm specification

### Error Protocol

**Standard Error Response**:

```json
{
    "error": "Human-readable error message"
}
```

**HTTP Status Code Protocol**:

- `200`: Successful operation
- `201`: Resource created successfully
- `400`: Invalid request parameters
- `401`: Authentication required/failed
- `404`: Resource not found
- `500`: Server error

## Protocol Integration

### Service Provider Integration

1. **Registration**: Register service with W3ID and endpoint details
2. **Discovery**: Service becomes discoverable via resolution protocol
3. **Maintenance**: Update service details as needed

### Client Integration

1. **Service Resolution**: Resolve W3ID to service endpoint
2. **Entropy Generation**: Request entropy for cryptographic operations
3. **Token Verification**: Verify tokens using JWK discovery

### Platform Integration

1. **Certification**: Obtain platform certification tokens
2. **Discovery**: Discover available platforms in ecosystem
3. **Verification**: Verify platform tokens for integration

## Protocol Security Considerations

### Authentication Protocol

1. **Shared Secret**: Strong, randomly generated shared secrets
2. **Token Security**: Secure token generation and verification
3. **Key Management**: Secure storage and rotation of cryptographic keys

### Input Validation Protocol

1. **Parameter Validation**: Validate all input parameters
2. **Content Validation**: Validate request content and format
3. **Output Sanitization**: Sanitize all output responses

### Access Control Protocol

1. **Public Endpoints**: Service resolution, entropy generation, key discovery
2. **Protected Endpoints**: Service registration, platform certification
3. **Rate Limiting**: Implement rate limiting for public endpoints

## Protocol Deployment

### Environment Configuration

Required environment variables:

- Database connection string
- Shared secret for authentication
- Cryptographic key material
- Platform URLs for discovery

### Network Configuration

1. **HTTPS**: Always use HTTPS in production
2. **CORS**: Configure appropriate CORS policies
3. **Load Balancing**: Support for horizontal scaling
4. **Monitoring**: Health checks and monitoring endpoints

### Backup and Recovery

1. **Database Backups**: Regular backup of service registry
2. **Key Backup**: Secure backup of cryptographic keys
3. **Disaster Recovery**: Recovery procedures for service restoration

## Protocol Compliance

### Standards Compliance

1. **JWT RFC 7519**: Token format and processing
2. **JWK RFC 7517**: Key format and discovery
3. **HTTP Standards**: RESTful API design principles
4. **CORS Standards**: Cross-origin resource sharing

### Interoperability

1. **W3ID Integration**: Compatible with W3ID standards
2. **JWT Libraries**: Compatible with standard JWT libraries
3. **HTTP Clients**: Compatible with standard HTTP clients
4. **Database Systems**: Compatible with standard database systems

This protocol specification defines the complete interface for implementing registry services that provide decentralized service discovery and cryptographic operations within a distributed identity ecosystem.
