# Control Panel

A SvelteKit-based control panel for monitoring and managing various services and platforms.

## Features

### eVault Monitoring

- **Real-time eVault Discovery**: Automatically discovers eVault pods across all Kubernetes namespaces
- **Pod Information**: Displays comprehensive pod details including status, readiness, restarts, age, IP, and node
- **Live Logs**: View real-time logs from eVault pods with automatic refresh
- **Pod Details**: Access detailed pod information including YAML configuration and resource usage
- **Metrics**: View pod performance metrics (when metrics-server is available)

## Prerequisites

### Kubernetes Access

- `kubectl` must be installed and configured
- Access to the Kubernetes cluster where eVaults are running
- Proper RBAC permissions to list and describe pods

### System Requirements

- Node.js 18+
- Access to execute `kubectl` commands

## Installation

1. Install dependencies:

```bash
npm install
```

2. Ensure kubectl is configured:

```bash
kubectl cluster-info
```

## Usage

### Development

```bash
npm run dev
```

### Building

```bash
npm run build
```

## eVault Monitoring

### Main Dashboard

The main page displays a table of all eVault pods found across your Kubernetes cluster:

- **Name**: Clickable link to detailed pod view
- **Namespace**: Kubernetes namespace where the pod is running
- **Status**: Current pod status (Running, Pending, Failed, etc.)
- **Ready**: Number of ready containers vs total containers
- **Restarts**: Number of container restarts
- **Age**: How long the pod has been running
- **IP**: Pod IP address
- **Node**: Kubernetes node where the pod is scheduled

### Detailed Pod View

Click on any eVault name to access detailed monitoring:

#### Logs Tab

- Real-time pod logs with automatic refresh
- Configurable log tail length
- Terminal-style display for easy reading

#### Details Tab

- Complete pod description from `kubectl describe pod`
- YAML configuration from `kubectl get pod -o yaml`
- Resource requests and limits
- Environment variables and volume mounts

#### Metrics Tab

- CPU and memory usage (requires metrics-server)
- Resource consumption trends
- Performance monitoring data

### API Endpoints

#### GET /api/evaults

Returns a list of all eVault pods across all namespaces.

#### GET /api/evaults/[namespace]/[pod]/logs?tail=[number]

Returns the most recent logs from a specific pod.

#### GET /api/evaults/[namespace]/[pod]/details

Returns detailed information about a specific pod.

## Configuration

### eVault Detection

The system automatically detects eVault pods by filtering for pods with names containing:

- `evault`
- `vault`
- `web3`

You can modify the filter in `src/routes/api/evaults/+server.ts` to adjust detection criteria.

### Log Tail Length

Default log tail length is 100 lines. This can be configured via the `tail` query parameter.

## Troubleshooting

### No eVaults Found

1. Verify kubectl is configured: `kubectl cluster-info`
2. Check if eVault pods are running: `kubectl get pods --all-namespaces`
3. Verify pod names contain expected keywords
4. Check RBAC permissions for pod listing

### Permission Denied

Ensure your kubectl context has permissions to:

- List pods across namespaces
- Describe pods
- Access pod logs
- View pod metrics (if using metrics-server)

### Metrics Not Available

If the metrics tab shows no data:

1. Verify metrics-server is installed: `kubectl get pods -n kube-system | grep metrics`
2. Check metrics-server logs for errors
3. Ensure HPA (Horizontal Pod Autoscaler) is configured if needed

## Security Considerations

- The control panel executes kubectl commands on the server
- Ensure proper access controls and authentication
- Consider implementing role-based access control
- Monitor and audit kubectl command execution

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[Add your license information here]
