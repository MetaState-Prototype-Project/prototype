/**
 * In-process fan-out from the wallet callback to the browser's SSE stream.
 * Single instance only: a second replica would never hear these events.
 */

import { EventEmitter } from "node:events";

export type SessionEvent = "approved" | "attempt_failed";

export class SessionBus {
    private readonly emitter = new EventEmitter();

    constructor() {
        this.emitter.setMaxListeners(0);
    }

    emit(sessionId: string, event: SessionEvent): void {
        this.emitter.emit(sessionId, event);
    }

    /** Subscribes to a session's events; returns the unsubscribe function. */
    subscribe(
        sessionId: string,
        listener: (event: SessionEvent) => void,
    ): () => void {
        this.emitter.on(sessionId, listener);
        return () => this.emitter.off(sessionId, listener);
    }
}
