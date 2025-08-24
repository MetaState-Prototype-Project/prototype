import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface EVault {
	id: string;
	name: string;
	namespace: string;
	status: string;
	age: string;
	ready: string;
	restarts: number;
	image: string;
	ip: string;
	node: string;
	evaultId: string;
	serviceUrl?: string;
	podName?: string; // Add pod name for logs access
}

export const GET: RequestHandler = async () => {
	try {
		// Get external IP from Kubernetes nodes
		let externalIP = 'localhost';
		try {
			// First try to get external IP from nodes
			const { stdout: nodesOutput } = await execAsync('kubectl get nodes -o json');
			const nodes = JSON.parse(nodesOutput);
			
			// Look for external IP in node addresses
			for (const node of nodes.items) {
				if (node.status && node.status.addresses) {
					for (const address of node.status.addresses) {
						if (address.type === 'ExternalIP' && address.address) {
							externalIP = address.address;
							console.log('Found external IP from node:', externalIP);
							break;
						}
					}
					if (externalIP !== 'localhost') break;
				}
			}
			
			// If no external IP found, try to get internal IP
			if (externalIP === 'localhost') {
				for (const node of nodes.items) {
					if (node.status && node.status.addresses) {
						for (const address of node.status.addresses) {
							if (address.type === 'InternalIP' && address.address) {
								// Check if it's not a localhost/127.0.0.1 address
								if (!address.address.startsWith('127.') && address.address !== 'localhost') {
									externalIP = address.address;
									console.log('Found internal IP from node:', externalIP);
									break;
								}
							}
						}
						if (externalIP !== 'localhost') break;
					}
				}
			}
			
			// If still no IP found, try minikube ip as fallback
			if (externalIP === 'localhost') {
				const { stdout: minikubeIPOutput } = await execAsync('minikube ip 2>/dev/null || echo ""');
				if (minikubeIPOutput.trim() && minikubeIPOutput.trim() !== 'localhost') {
					externalIP = minikubeIPOutput.trim();
					console.log('Using minikube IP:', externalIP);
				}
			}
			
			// If still no IP, try to get the host IP from kubectl config
			if (externalIP === 'localhost') {
				const { stdout: configOutput } = await execAsync('kubectl config view --minify -o json');
				const config = JSON.parse(configOutput);
				if (config.clusters && config.clusters[0] && config.clusters[0].cluster && config.clusters[0].cluster.server) {
					const serverUrl = config.clusters[0].cluster.server;
					const urlMatch = serverUrl.match(/https?:\/\/([^:]+):/);
					if (urlMatch && urlMatch[1] && urlMatch[1] !== 'localhost' && urlMatch[1] !== '127.0.0.1') {
						externalIP = urlMatch[1];
						console.log('Using IP from kubectl config:', externalIP);
					}
				}
			}
			
		} catch (ipError) {
			console.log('Could not get external IP, using localhost:', ipError);
		}

		console.log('Using IP for services:', externalIP);

		// Get all namespaces
		const { stdout: namespacesOutput } = await execAsync('kubectl get namespaces -o json');
		const namespaces = JSON.parse(namespacesOutput);

		// Filter for eVault namespaces
		const evaultNamespaces = namespaces.items
			.filter((ns: any) => ns.metadata.name.startsWith('evault-'))
			.map((ns: any) => ns.metadata.name);

		console.log('Found eVault namespaces:', evaultNamespaces);

		let allEVaults: EVault[] = [];

		// Get services and pods from each eVault namespace
		for (const namespace of evaultNamespaces) {
			try {
				// Get services in this namespace as JSON
				const { stdout: servicesOutput } = await execAsync(
					`kubectl get services -n ${namespace} -o json`
				);
				const services = JSON.parse(servicesOutput);

				// Get pods in this namespace as JSON
				const { stdout: podsOutput } = await execAsync(
					`kubectl get pods -n ${namespace} -o json`
				);
				const pods = JSON.parse(podsOutput);

				console.log(`=== SERVICES FOR ${namespace} ===`);
				console.log(JSON.stringify(services, null, 2));
				console.log(`=== PODS FOR ${namespace} ===`);
				console.log(JSON.stringify(pods, null, 2));
				console.log(`=== END DATA ===`);

				if (services.items && services.items.length > 0) {
					for (const service of services.items) {
						const serviceName = service.metadata.name;
						const serviceType = service.spec.type;
						const ports = service.spec.ports;

						console.log(`Service: ${serviceName}, Type: ${serviceType}, Ports:`, ports);

						// Find NodePort for NodePort services
						let nodePort = null;
						if (serviceType === 'NodePort' && ports) {
							for (const port of ports) {
								if (port.nodePort) {
									nodePort = port.nodePort;
									break;
								}
							}
						}

						console.log(`NodePort: ${nodePort}`);

						// Get pod data for this service
						let podData = {
							status: 'Unknown',
							age: 'N/A',
							ready: '0/0',
							restarts: 0,
							image: 'N/A',
							ip: 'N/A',
							node: 'N/A',
							podName: 'N/A'
						};

						if (pods.items && pods.items.length > 0) {
							// Find pod that matches this service (usually same name or has service label)
							const matchingPod = pods.items.find(
								(pod: any) =>
									pod.metadata.name.includes(
										serviceName.replace('-service', '')
									) || pod.metadata.labels?.app === 'evault'
							);

							if (matchingPod) {
								const pod = matchingPod;
								const readyCount =
									pod.status.containerStatuses?.filter((cs: any) => cs.ready)
										.length || 0;
								const totalCount = pod.status.containerStatuses?.length || 0;
								const restarts =
									pod.status.containerStatuses?.reduce(
										(sum: number, cs: any) => sum + (cs.restartCount || 0),
										0
									) || 0;

								// Calculate age
								const creationTime = new Date(pod.metadata.creationTimestamp);
								const now = new Date();
								const ageMs = now.getTime() - creationTime.getTime();
								const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
								const ageHours = Math.floor(
									(ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
								);
								const age =
									ageDays > 0 ? `${ageDays}d${ageHours}h` : `${ageHours}h`;

								podData = {
									status: pod.status.phase || 'Unknown',
									age: age,
									ready: `${readyCount}/${totalCount}`,
									restarts: restarts,
									image: pod.spec.containers?.[0]?.image || 'N/A',
									ip: pod.status.podIP || 'N/A',
									node: pod.spec.nodeName || 'N/A',
									podName: pod.metadata.name || 'N/A'
								};
							}
						}

						// Extract the eVault ID from the namespace
						const evaultId = namespace.replace('evault-', '');

						// Generate service URL
						let serviceUrl = '';
						if (nodePort) {
							serviceUrl = `http://${externalIP}:${nodePort}`;
						}

						console.log(`Service URL: ${serviceUrl}`);

						allEVaults.push({
							id: serviceName,
							name: serviceName,
							namespace: namespace,
							status: podData.status,
							age: podData.age,
							ready: podData.ready,
							restarts: podData.restarts,
							image: podData.image,
							ip: podData.ip,
							node: podData.node,
							evaultId: evaultId,
							serviceUrl: serviceUrl,
							podName: podData.podName
						});
					}
				}
			} catch (namespaceError) {
				console.log(`Error accessing namespace ${namespace}:`, namespaceError);
			}
		}

		console.log(`Total eVaults found: ${allEVaults.length}`);
		return json({ evaults: allEVaults });
	} catch (error) {
		console.error('Error fetching eVaults:', error);
		return json({ error: 'Failed to fetch eVaults', evaults: [] }, { status: 500 });
	}
};
