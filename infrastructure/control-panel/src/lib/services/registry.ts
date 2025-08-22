import { env } from '$env/dynamic/public';

export interface Platform {
	name: string;
	url: string;
	status: 'Active' | 'Inactive';
	uptime: string;
}

export class RegistryService {
	private baseUrl: string;

	constructor() {
		this.baseUrl = env.PUBLIC_REGISTRY_URL || 'https://registry.staging.metastate.foundation';
	}

	async getPlatforms(): Promise<Platform[]> {
		try {
			const response = await fetch(`${this.baseUrl}/platforms`);
			
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const platformUrls: string[] = await response.json();
			
			// Convert URLs to platform objects with friendly names
			const platforms = platformUrls.map(url => {
				// Ensure URL has protocol
				const urlWithProtocol = url.startsWith('http://') || url.startsWith('https://') ? url : `http://${url}`;
				const urlObj = new URL(urlWithProtocol);
				const hostname = urlObj.hostname;
				const port = urlObj.port;
				const protocol = urlObj.protocol;
				
				// Extract platform name from hostname
				let name = hostname.split('.')[0];
				
				// Capitalize and format the name
				if (name === 'pictique') name = 'Pictique';
				else if (name === 'blabsy') name = 'Blabsy';
				else if (name === 'charter') name = 'Group Charter';
				else if (name === 'cerberus') name = 'Cerberus';
				else if (name === 'evoting') name = 'eVoting';
				else name = name.charAt(0).toUpperCase() + name.slice(1);

				// Build the full URL with protocol and port
				const fullUrl = port ? `${hostname}:${port}` : hostname;
				const displayUrl = `${protocol}//${fullUrl}`;

				return {
					name,
					url: displayUrl,
					status: 'Active' as const,
					uptime: '24h'
				};
			});
			
			return platforms;
		} catch (error) {
			console.error('Error fetching platforms from registry:', error);
			
			// Return fallback platforms if registry is unavailable
			return [
				{
					name: 'Blabsy',
					url: 'http://192.168.0.225:4444',
					status: 'Active',
					uptime: '24h'
				},
				{
					name: 'Pictique',
					url: 'http://192.168.0.225:1111',
					status: 'Active',
					uptime: '24h'
				},
				{
					name: 'Group Charter',
					url: 'http://192.168.0.225:5555',
					status: 'Active',
					uptime: '24h'
				},
				{
					name: 'Cerberus',
					url: 'http://192.168.0.225:6666',
					status: 'Active',
					uptime: '24h'
				}
			];
		}
	}
}

export const registryService = new RegistryService(); 