# Evault Provisioner

A TypeScript API for provisioning evault instances on Nomad. This service allows you to spin up evault instances with Neo4j backends for different tenants.

## Prerequisites

- Node.js 18+
- Docker
- Nomad (see setup instructions below)
- OrbStack (for macOS users)

## Nomad Setup

### macOS Setup (using OrbStack)

Due to CNI bridge plugin requirements, running Nomad on macOS is best done through OrbStack:

1. Install OrbStack: https://orbstack.dev/
2. Create a new VM in OrbStack
3. SSH into the VM and install Nomad:

```bash
# Install Nomad
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install nomad

# Install CNI plugins
sudo mkdir -p /opt/cni/bin
curl -L https://github.com/containernetworking/plugins/releases/download/v1.3.0/cni-plugins-linux-amd64-v1.3.0.tgz | sudo tar -C /opt/cni/bin -xz
```

4. Start Nomad in dev mode:

```bash
sudo nomad agent -dev -network-interface=eth0 -log-level=DEBUG -bind=0.0.0.0
```

### Linux Setup

1. Install Nomad:

```bash
# Install Nomad
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install nomad

# Install CNI plugins
sudo mkdir -p /opt/cni/bin
curl -L https://github.com/containernetworking/plugins/releases/download/v1.3.0/cni-plugins-linux-amd64-v1.3.0.tgz | sudo tar -C /opt/cni/bin -xz
```

2. Start Nomad in dev mode:

```bash
sudo nomad agent -dev -network-interface=eth0 -log-level=DEBUG -bind=0.0.0.0
```

## Project Setup

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

## Architecture

The provisioner creates a Nomad job that consists of two tasks:

1. **Neo4j Task**:

   - Runs Neo4j 5.15
   - Exposes ports: 7687 (bolt) and 7474 (browser)
   - Uses dynamic ports for flexibility
   - 2GB memory allocation

2. **Evault Task**:
   - Runs the evault application
   - Connects to Neo4j via localhost
   - Uses dynamic port allocation
   - 512MB memory allocation
   - Depends on Neo4j task

## Environment Variables

- `PORT` - Port to run the API on (default: 3000)
- `NOMAD_ADDR` - Nomad API address (default: http://localhost:4646)

## Troubleshooting

### Common Issues

1. **Port Allocation Issues**:

   - Ensure Nomad is running with CNI plugins installed
   - Check that the network interface is correctly specified
   - Verify that ports are not already in use

2. **Container Networking**:

   - Ensure Docker is running
   - Check that the bridge network is properly configured
   - Verify container-to-container communication

3. **Nomad Job Failures**:
   - Check Nomad logs for detailed error messages
   - Verify that all required images are available
   - Ensure resource allocations are sufficient

### Debugging

To debug Nomad issues:

```bash
# View Nomad logs
journalctl -u nomad -f

# Check Nomad status
nomad status

# View specific job details
nomad job status evault-<tenant-id>

# View allocation details
nomad alloc status <allocation-id>
```

## Development

The project uses TypeScript for type safety and better development experience. The source files are in the `src` directory and are compiled to the `dist` directory.

For development, you can use `npm run dev` which uses `tsx` to run the TypeScript files directly without compilation.
