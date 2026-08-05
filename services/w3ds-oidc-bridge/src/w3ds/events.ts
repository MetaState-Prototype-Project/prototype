import { SESSION_TTL_MS, TtlMap } from "../store.js";

/**
 * What the QR page is told.
 *
 * `redirect` carries the browser back to Forgejo with an authorisation code.
 * `error` is the only way the page ever learns something went wrong — the person
 * is looking at a QR code, and their wallet reported the failure to us, not to
 * them.
 */
export type SessionEvent =
    | { type: "redirect"; url: string }
    | { type: "error"; message: string };

/**
 * The subset of an Express `Response` an SSE stream needs. Narrow on purpose, so
 * tests can drive it with a few lines instead of a server.
 */
export interface EventSink {
    write(chunk: string): void;
    end(): void;
    on(event: "close", listener: () => void): void;
}

export interface SessionStreams {
    /** Attaches a sink and immediately replays a pending event, if one is waiting. */
    subscribe(session: string, sink: EventSink): void;
    publish(session: string, event: SessionEvent): void;
    /** Number of attached sinks, for tests and for logging. */
    subscriberCount(session: string): number;
    /** Stops every heartbeat. Called when the process shuts down. */
    closeAll(): void;
}

interface Attached {
    sink: EventSink;
    heartbeat?: ReturnType<typeof setInterval>;
}

export interface SessionStreamOptions {
    /**
     * Matches the 30-second heartbeat the W3DS platforms use. Proxies drop an
     * idle stream, and a dropped stream looks exactly like a login that is still
     * waiting. Set to 0 in tests.
     */
    heartbeatMs?: number;
    now?: () => number;
}

export function createSessionStreams(
    options: SessionStreamOptions = {},
): SessionStreams {
    const heartbeatMs = options.heartbeatMs ?? 30_000;
    const subscribers = new Map<string, Set<Attached>>();

    // A wallet can answer before the browser has opened its stream — a fast scan,
    // or an EventSource reconnecting. Without this the login would hang despite
    // having succeeded. Expires with the session it belongs to.
    const pending = new TtlMap<SessionEvent>(SESSION_TTL_MS, options.now);

    function send(sink: EventSink, event: SessionEvent): void {
        sink.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    }

    return {
        subscribe(session, sink) {
            sink.write(": connected\n\n");

            const waiting = pending.take(session);
            if (waiting) {
                send(sink, waiting);
                sink.end();
                return;
            }

            const attached: Attached = { sink };
            if (heartbeatMs > 0) {
                attached.heartbeat = setInterval(
                    () => sink.write(": ping\n\n"),
                    heartbeatMs,
                );
                attached.heartbeat.unref?.();
            }

            const set = subscribers.get(session) ?? new Set<Attached>();
            set.add(attached);
            subscribers.set(session, set);

            sink.on("close", () => {
                if (attached.heartbeat) clearInterval(attached.heartbeat);
                set.delete(attached);
                if (set.size === 0) subscribers.delete(session);
            });
        },

        publish(session, event) {
            const set = subscribers.get(session);
            if (!set || set.size === 0) {
                pending.set(session, event);
                return;
            }

            for (const attached of set) {
                send(attached.sink, event);
                if (attached.heartbeat) clearInterval(attached.heartbeat);
                attached.sink.end();
            }
            subscribers.delete(session);
        },

        subscriberCount(session) {
            return subscribers.get(session)?.size ?? 0;
        },

        closeAll() {
            for (const set of subscribers.values()) {
                for (const attached of set) {
                    if (attached.heartbeat) clearInterval(attached.heartbeat);
                    attached.sink.end();
                }
            }
            subscribers.clear();
        },
    };
}
