/** Opaque access tokens, valid only at /userinfo. */

import { randomBytes } from "node:crypto";

export interface AccessToken {
    clientId: string;
    claims: Record<string, unknown>;
    expiresAt: number;
}

export class AccessTokenStore {
    private readonly tokens = new Map<string, AccessToken>();

    constructor(private readonly ttlMs: number) {}

    issue(
        clientId: string,
        claims: Record<string, unknown>,
        now: number,
    ): string {
        const token = randomBytes(32).toString("base64url");
        this.tokens.set(token, {
            clientId,
            claims,
            expiresAt: now + this.ttlMs,
        });
        return token;
    }

    get(token: string, now: number): AccessToken | undefined {
        const entry = this.tokens.get(token);
        if (!entry || now >= entry.expiresAt) return undefined;
        return entry;
    }

    revoke(token: string): void {
        this.tokens.delete(token);
    }

    sweep(now: number): void {
        for (const [token, entry] of this.tokens) {
            if (now >= entry.expiresAt) this.tokens.delete(token);
        }
    }

    get size(): number {
        return this.tokens.size;
    }
}
