import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lokiService } from '$lib/services/loki';

export const GET: RequestHandler = async () => {
	const stream = new ReadableStream({
		start(controller) {
			let isConnected = true;
			let stopStreaming: (() => void) | null = null;
			
			// Send initial connection message
			if (isConnected) {
				controller.enqueue(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
			}

			// Helper function to safely enqueue data
			const safeEnqueue = (data: any) => {
				if (isConnected) {
					try {
						controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
					} catch (error) {
						console.log('Client disconnected, stopping stream');
						isConnected = false;
						if (stopStreaming) stopStreaming();
					}
				}
			};

			// Start streaming real logs from Loki
			const startRealTimeLogs = async () => {
				try {
					stopStreaming = await lokiService.streamLogs(
						'{app="web3-adapter"}',
						(log) => {
							// Parse the log entry to extract flow information
							const flowEvent = lokiService.parseLogEntry(log);
							
							if (flowEvent) {
								// Map the flow event to the expected format
								const eventData = {
									type: 'evault_sync_event',
									timestamp: flowEvent.timestamp,
									w3id: flowEvent.w3id,
									platform: flowEvent.platform,
									id: flowEvent.id,
									tableName: flowEvent.tableName,
									message: flowEvent.message,
									// Extract platform and eVault indices for visualization
									platformIndex: 0, // We'll need to map this based on actual platform names
									evaultIndex: 0    // We'll need to map this based on actual eVault w3ids
								};
								
								safeEnqueue(eventData);
							}
						}
					);
				} catch (error) {
					console.error('Error starting Loki stream:', error);
					// Fallback to mock data if Loki is not available
					startMockData();
				}
			};

			// Fallback mock data function
			const startMockData = () => {
				console.log('Using mock data as fallback');
				
				// Step 1: Platform 1 creates a message
				const timeout1 = setTimeout(() => {
					safeEnqueue({
						type: 'platform_message_created',
						platformIndex: 1,
						platformName: 'Pictique',
						message: 'Creating new message in blob storage',
						timestamp: new Date().toISOString()
					});
				}, 3000);

				// Step 2: Request sent to eVault 0
				const timeout2 = setTimeout(() => {
					safeEnqueue({
						type: 'request_sent_to_evault',
						platformIndex: 1,
						evaultIndex: 0,
						message: 'Request sent to eVault',
						timestamp: new Date().toISOString()
					});
				}, 8000);

				// Step 3: eVault 0 creates metaenvelope
				const timeout3 = setTimeout(() => {
					const uuid = crypto.randomUUID();
					safeEnqueue({
						type: 'evault_metaenvelope_created',
						evaultIndex: 0,
						uuid: uuid,
						message: `Created metaenvelope with ID: ${uuid}`,
						timestamp: new Date().toISOString()
					});
				}, 13000);

				// Step 4: Notify all platforms through awareness protocol
				const timeout4 = setTimeout(() => {
					safeEnqueue({
						type: 'notify_platforms_awareness',
						evaultIndex: 0,
						message: 'Notifying platforms through awareness protocol',
						timestamp: new Date().toISOString()
					});
				}, 18000);

				// Cleanup function for mock timeouts
				return () => {
					clearTimeout(timeout1);
					clearTimeout(timeout2);
					clearTimeout(timeout3);
					clearTimeout(timeout4);
				};
			};

			// Try to start real-time logs, fallback to mock if needed
			startRealTimeLogs().catch(() => {
				startMockData();
			});

			// Keep connection alive with periodic heartbeats
			const heartbeat = setInterval(() => {
				if (isConnected) {
					try {
						controller.enqueue(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
					} catch (error) {
						console.log('Client disconnected during heartbeat, stopping stream');
						isConnected = false;
						clearInterval(heartbeat);
						if (stopStreaming) stopStreaming();
					}
				}
			}, 30000);

			// Cleanup function
			const cleanup = () => {
				isConnected = false;
				if (stopStreaming) stopStreaming();
				clearInterval(heartbeat);
			};

			// Handle client disconnect
			const handleDisconnect = () => {
				console.log('Client disconnected, cleaning up...');
				cleanup();
			};

			// Return cleanup function
			return () => {
				cleanup();
			};
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Cache-Control'
		}
	});
}; 