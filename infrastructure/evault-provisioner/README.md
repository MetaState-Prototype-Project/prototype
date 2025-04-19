# Evault Provisioner API

A TypeScript Express API for provisioning evault instances on Nomad.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the project:

```bash
npm run build
```

3. Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Endpoints

### Health Check

```
GET /health
```

Returns the health status of the API.

### Provision Evault

```
POST /provision
```

Provisions a new evault instance for a tenant.

Request body:

```json
{
  "tenantId": "your-tenant-id"
}
```

Response:

```json
{
  "success": true,
  "message": "Successfully provisioned evault for tenant your-tenant-id",
  "jobName": "evault-your-tenant-id"
}
```

## Environment Variables

- `PORT` - Port to run the API on (default: 3000)
- `NOMAD_ADDR` - Nomad API address (default: http://localhost:4646)

## Requirements

- Node.js 18+
- TypeScript 5.3+
- Nomad running locally or accessible via the configured address

## Development

The project uses TypeScript for type safety and better development experience. The source files are in the `src` directory and are compiled to the `dist` directory.

For development, you can use `npm run dev` which uses `tsx` to run the TypeScript files directly without compilation.
