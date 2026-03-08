import { randomUUID } from 'node:crypto';

const SESSION_TTL_MS = 5 * 60 * 1000;

export type SessionResult =
	| { status: 'success'; ename: string }
	| { status: 'error'; message: string };

type SessionRecord = {
	id: string;
	createdAt: number;
	consumed: boolean;
	result?: SessionResult;
	subscribers: Set<(result: SessionResult) => void>;
};

const sessions = new Map<string, SessionRecord>();

function isExpired(record: SessionRecord, now = Date.now()): boolean {
	return now - record.createdAt > SESSION_TTL_MS;
}

function cleanupExpiredSessions(): void {
	const now = Date.now();
	for (const [id, record] of sessions.entries()) {
		if (isExpired(record, now)) {
			sessions.delete(id);
		}
	}
}

export function createAuthSession(): string {
	cleanupExpiredSessions();
	const id = randomUUID();
	sessions.set(id, {
		id,
		createdAt: Date.now(),
		consumed: false,
		subscribers: new Set()
	});
	return id;
}

export function consumeAuthSession(id: string): boolean {
	cleanupExpiredSessions();
	const session = sessions.get(id);
	if (!session || session.consumed || isExpired(session)) {
		return false;
	}

	session.consumed = true;
	return true;
}

export function getAuthSessionResult(id: string): SessionResult | undefined {
	cleanupExpiredSessions();
	return sessions.get(id)?.result;
}

export function publishAuthSessionResult(id: string, result: SessionResult): void {
	cleanupExpiredSessions();
	const session = sessions.get(id);
	if (!session) return;

	session.result = result;
	for (const subscriber of session.subscribers) {
		try {
			subscriber(result);
		} catch (error) {
			console.error('[auth] Failed notifying session subscriber:', error);
		}
	}
	session.subscribers.clear();
}

export function subscribeToAuthSession(
	id: string,
	listener: (result: SessionResult) => void
): (() => void) | null {
	cleanupExpiredSessions();
	const session = sessions.get(id);
	if (!session || isExpired(session)) {
		return null;
	}

	session.subscribers.add(listener);

	return () => {
		session.subscribers.delete(listener);
	};
}
