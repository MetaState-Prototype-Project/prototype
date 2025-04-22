# Registry Service

A service that provides entropy generation and service discovery functionality.

## Endpoints

### GET /entropy

Returns a signed JWT containing 20 alphanumeric characters of entropy.

- The JWT is signed using ES256
- The entropy is valid for 1 hour
- Response format: `{ token: string }`

### GET /.well-known/jwks.json

Returns the JSON Web Key (JWK) used for signing the entropy JWTs.

- Used for JWT verification
- Response format: JWK set containing the public key

### GET /resolve?w3id=<w3id>

Resolves a service based on its w3id metadata in Consul.

- Query parameter: `w3id` (required)
- Returns the service details if found
- Returns 404 if no service with matching w3id is found

## Configuration

The service can be configured using environment variables:

- `CONSUL_HOST`: Consul server host (default: localhost)
- `CONSUL_PORT`: Consul server port (default: 8500)

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```
