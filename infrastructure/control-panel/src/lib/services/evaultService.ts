import type { EVault } from '../../routes/api/evaults/+server';

export class EVaultService {
	static async getEVaults(): Promise<EVault[]> {
		try {
			const response = await fetch('/api/evaults');
			if (!response.ok) {
				throw new Error('Failed to fetch eVaults');
			}
			const data = await response.json();
			return data.evaults || [];
		} catch (error) {
			console.error('Error fetching eVaults:', error);
			return [];
		}
	}

	static async getEVaultLogs(namespace: string, podName: string, tail: number = 100): Promise<string[]> {
		try {
			const response = await fetch(`/api/evaults/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/logs?tail=${tail}`);
			if (!response.ok) {
				throw new Error('Failed to fetch logs');
			}
			const data = await response.json();
			return data.logs || [];
		} catch (error) {
			console.error('Error fetching logs:', error);
			return [];
		}
	}

	static async getEVaultDetails(namespace: string, podName: string): Promise<any> {
		try {
			const response = await fetch(`/api/evaults/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/details`);
			if (!response.ok) {
				throw new Error('Failed to fetch eVault details');
			}
			return await response.json();
		} catch (error) {
			console.error('Error fetching eVault details:', error);
			return null;
		}
	}

	static async getEVaultMetrics(namespace: string, podName: string): Promise<any> {
		try {
			const response = await fetch(`/api/evaults/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/metrics`);
			if (!response.ok) {
				throw new Error('Failed to fetch metrics');
			}
			return await response.json();
		} catch (error) {
			console.error('Error fetching eVault metrics:', error);
			return null;
		}
	}
} 