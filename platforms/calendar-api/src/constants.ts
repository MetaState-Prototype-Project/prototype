export const CALENDAR_EVENT_ONTOLOGY_ID =
  "880e8400-e29b-41d4-a716-446655440099";

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface StoredSession {
  createdAt: number;
}

export const sessionStore = new Map<string, StoredSession>();

export function addSession(sessionId: string): void {
  sessionStore.set(sessionId, { createdAt: Date.now() });
}

export function isSessionValid(sessionId: string): boolean {
  const s = sessionStore.get(sessionId);
  if (!s) return false;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    sessionStore.delete(sessionId);
    return false;
  }
  sessionStore.delete(sessionId); // one-time use
  return true;
}
