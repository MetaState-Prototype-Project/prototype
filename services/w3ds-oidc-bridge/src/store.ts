/**
 * The bridge's entire state: two short-lived maps.
 *
 * Nothing is persisted. A restart drops in-flight logins, which is the right
 * trade for a five-minute window — and the access token is a JWT, so it needs no
 * third map.
 */

/** A login has five minutes between the QR appearing and the wallet answering. */
export const SESSION_TTL_MS = 5 * 60 * 1000;

/** An authorisation code only has to survive one redirect. */
export const CODE_TTL_MS = 60 * 1000;

/** What `/authorize` captured, plus the eName once the wallet has proved it. */
export interface AuthSession {
    clientId: string;
    redirectUri: string;
    state?: string;
    nonce?: string;
    codeChallenge: string;
    ename?: string;
}

/** Bound to the same tuple, so a code cannot be replayed against another client. */
export interface AuthCode {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    nonce?: string;
    ename: string;
}

interface Entry<T> {
    value: T;
    expiresAt: number;
}

/**
 * A map whose entries disappear on their own.
 *
 * The clock is injectable so tests can advance time without waiting or reaching
 * for fake timers.
 */
export class TtlMap<T> {
    private readonly entries = new Map<string, Entry<T>>();

    constructor(
        private readonly ttlMs: number,
        private readonly now: () => number = Date.now,
    ) {}

    set(key: string, value: T): void {
        this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    }

    get(key: string): T | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= this.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry.value;
    }

    /**
     * Reads and removes in one step, so a value can only ever be used once.
     *
     * This is what makes an authorisation code single-use. Node runs this to
     * completion before any other request is handled, so two concurrent
     * exchanges cannot both win.
     */
    take(key: string): T | undefined {
        const value = this.get(key);
        if (value !== undefined) this.entries.delete(key);
        return value;
    }

    /** Replaces a live entry, keeping its original expiry. */
    update(key: string, value: T): boolean {
        const entry = this.entries.get(key);
        if (!entry || entry.expiresAt <= this.now()) {
            this.entries.delete(key);
            return false;
        }
        entry.value = value;
        return true;
    }

    delete(key: string): void {
        this.entries.delete(key);
    }

    /** Evicts everything expired. Returns how many, for logging. */
    sweep(): number {
        const now = this.now();
        let evicted = 0;
        for (const [key, entry] of this.entries) {
            if (entry.expiresAt <= now) {
                this.entries.delete(key);
                evicted += 1;
            }
        }
        return evicted;
    }

    get size(): number {
        return this.entries.size;
    }
}

export interface Store {
    sessions: TtlMap<AuthSession>;
    codes: TtlMap<AuthCode>;
    sweep(): void;
}

export function createStore(now: () => number = Date.now): Store {
    const sessions = new TtlMap<AuthSession>(SESSION_TTL_MS, now);
    const codes = new TtlMap<AuthCode>(CODE_TTL_MS, now);

    return {
        sessions,
        codes,
        // Reading expires lazily, so this only matters for entries nobody comes
        // back for — an abandoned QR page, a wallet that never answers.
        sweep() {
            sessions.sweep();
            codes.sweep();
        },
    };
}
