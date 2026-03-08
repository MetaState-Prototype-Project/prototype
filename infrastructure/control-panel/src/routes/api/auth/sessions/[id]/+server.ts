import type { RequestHandler } from './$types';
import {
	getAuthSessionResult,
	subscribeToAuthSession,
	type SessionResult
} from '$lib/server/auth/sessions';

function toSseData(payload: unknown): string {
	return `data: ${JSON.stringify(payload)}\n\n`;
}

export const GET: RequestHandler = async ({ params, request }) => {
	const { id } = params;

	const stream = new ReadableStream({
		start(controller) {
			let isClosed = false;
			let unsubscribe: (() => void) | null = null;
			let heartbeat: ReturnType<typeof setInterval> | null = null;

			const closeStream = () => {
				if (isClosed) return;
				isClosed = true;
				try {
					controller.close();
				} catch {
					// Ignore double-close races during abort/disconnect.
				}
			};

			const cleanup = () => {
				if (heartbeat) {
					clearInterval(heartbeat);
					heartbeat = null;
				}
				if (unsubscribe) {
					unsubscribe();
					unsubscribe = null;
				}
				closeStream();
			};

			const emit = (result: SessionResult) => {
				if (isClosed) return;
				try {
					controller.enqueue(toSseData(result));
				} catch {
					cleanup();
				}
			};

			const existing = getAuthSessionResult(id);
			if (existing) {
				emit(existing);
				closeStream();
				return;
			}

			unsubscribe = subscribeToAuthSession(id, (result) => {
				emit(result);
				cleanup();
			});

			if (!unsubscribe) {
				emit({ status: 'error', message: 'Session not found' });
				closeStream();
				return;
			}

			heartbeat = setInterval(() => {
				try {
					if (isClosed) return;
					controller.enqueue(`: heartbeat\n\n`);
				} catch {
					cleanup();
				}
			}, 25000);

			request.signal.addEventListener('abort', () => {
				cleanup();
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
