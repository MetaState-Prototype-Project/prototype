import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const stream = new ReadableStream({
		start(controller) {
			let isConnected = true;
			const timeouts: NodeJS.Timeout[] = [];
			
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
					}
				}
			};

			// Simulate the data flow sequence
			const timeout1 = setTimeout(() => {
				// Step 1: Platform 1 creates a message
				safeEnqueue({
					type: 'platform_message_created',
					platformIndex: 1,
					platformName: 'Pictique',
					message: 'Creating new message in blob storage',
					timestamp: new Date().toISOString()
				});
			}, 3000);
			timeouts.push(timeout1);

			const timeout2 = setTimeout(() => {
				// Step 2: Request sent to eVault 0
				safeEnqueue({
					type: 'request_sent_to_evault',
					platformIndex: 1,
					evaultIndex: 0,
					message: 'Request sent to eVault',
					timestamp: new Date().toISOString()
				});
			}, 8000);
			timeouts.push(timeout2);

			const timeout3 = setTimeout(() => {
				// Step 3: eVault 0 creates metaenvelope
				const uuid = crypto.randomUUID();
				safeEnqueue({
					type: 'evault_metaenvelope_created',
					evaultIndex: 0,
					uuid: uuid,
					message: `Created metaenvelope with ID: ${uuid}`,
					timestamp: new Date().toISOString()
				});
			}, 13000);
			timeouts.push(timeout3);

			const timeout4 = setTimeout(() => {
				// Step 4: Notify all platforms through awareness protocol
				safeEnqueue({
					type: 'notify_platforms_awareness',
					evaultIndex: 0,
					message: 'Notifying platforms through awareness protocol',
					timestamp: new Date().toISOString()
				});
			}, 18000);
			timeouts.push(timeout4);

			// Keep connection alive with periodic heartbeats
			const heartbeat = setInterval(() => {
				if (isConnected) {
					try {
						controller.enqueue(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
					} catch (error) {
						console.log('Client disconnected during heartbeat, stopping stream');
						isConnected = false;
						clearInterval(heartbeat);
					}
				}
			}, 30000);

			// Cleanup function
			const cleanup = () => {
				isConnected = false;
				timeouts.forEach(timeout => clearTimeout(timeout));
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