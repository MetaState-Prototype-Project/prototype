import { env } from '$env/dynamic/private';

export interface LogEntry {
	timestamp: string;
	line: string;
	labels: Record<string, string>;
}

export interface LokiQueryResponse {
	status: string;
	data: {
		resultType: string;
		result: Array<{
			stream: Record<string, string>;
			values: Array<[string, string]>;
		}>;
	};
}

export interface FlowEvent {
	type: 'evault_sync' | 'platform_sync' | 'metaenvelope_created' | 'awareness_notification';
	timestamp: string;
	w3id: string;
	platform: string;
	id: string;
	tableName: string;
	message: string;
}

export class LokiService {
	private baseUrl: string;
	private username: string;
	private password: string;
	private processedLogIds = new Set<string>(); // Track processed logs to prevent duplicates

	constructor() {
		this.baseUrl = env.LOKI_URL || 'http://localhost:3100';
		this.username = env.LOKI_USERNAME || 'admin';
		this.password = env.LOKI_PASSWORD || 'admin';
	}

	private getAuthHeaders() {
		return {
			'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
			'Content-Type': 'application/json'
		};
	}

	async queryLogs(query: string, start?: string, end?: string): Promise<LogEntry[]> {
		try {
			const params = new URLSearchParams({
				query,
				limit: '1000'
			});

			if (start) params.append('start', start);
			if (end) params.append('end', end);

			const response = await fetch(
				`${this.baseUrl}/loki/api/v1/query_range?${params.toString()}`,
				{
					headers: this.getAuthHeaders()
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data: LokiQueryResponse = await response.json();
			const entries: LogEntry[] = [];
			
			for (const result of data.data.result) {
				for (const [timestamp, line] of result.values) {
					entries.push({
						timestamp: new Date(parseInt(timestamp) / 1000000).toISOString(),
						line,
						labels: result.stream
					});
				}
			}

			return entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
		} catch (error) {
			console.error('Error querying Loki:', error);
			return [];
		}
	}

	async getWeb3AdapterLogs(start?: string, end?: string): Promise<FlowEvent[]> {
		const query = '{app="web3-adapter"}';
		const logs = await this.queryLogs(query, start, end);
		
		return logs
			.map(log => this.parseLogEntry(log))
			.filter((event): event is FlowEvent => event !== null);
	}

	parseLogEntry(log: LogEntry): FlowEvent | null {
		try {
			// Parse the JSON log line
			const logData = JSON.parse(log.line);
			
			// Check if this is a logger.info call with the structure we expect
			if (logData.tableName && logData.w3id && logData.platform && logData.id) {
				return {
					type: 'evault_sync',
					timestamp: log.timestamp,
					w3id: logData.w3id,
					platform: logData.platform,
					id: logData.id,
					tableName: logData.tableName,
					message: `Synced ${logData.tableName} with ID ${logData.id} to eVault ${logData.w3id} from platform ${logData.platform}`
				};
			}
		} catch (error) {
			// Skip logs that can't be parsed
		}
		
		return null;
	}

	async streamLogs(query: string, onLog: (log: LogEntry) => void): Promise<() => void> {
		let isStreaming = true;
		
		const streamLogs = async () => {
			while (isStreaming) {
				try {
					const end = new Date().toISOString();
					const start = new Date(Date.now() - 30000).toISOString(); // Last 30 seconds
					
					const logs = await this.queryLogs(query, start, end);
					
					for (const log of logs) {
						if (isStreaming) {
							// Create a unique ID for this log to prevent duplicates
							const logId = `${log.timestamp}-${log.line}`;
							if (!this.processedLogIds.has(logId)) {
								this.processedLogIds.add(logId);
								onLog(log);
								
								// Clean up old IDs to prevent memory leaks (keep last 1000)
								if (this.processedLogIds.size > 1000) {
									const idsArray = Array.from(this.processedLogIds);
									this.processedLogIds = new Set(idsArray.slice(-500));
								}
							}
						}
					}
					
					// Wait 2 seconds before next query
					await new Promise(resolve => setTimeout(resolve, 2000));
				} catch (error) {
					console.error('Error in log stream:', error);
					await new Promise(resolve => setTimeout(resolve, 5000));
				}
			}
		};

		streamLogs();

		return () => {
			isStreaming = false;
		};
	}
}

export const lokiService = new LokiService(); 