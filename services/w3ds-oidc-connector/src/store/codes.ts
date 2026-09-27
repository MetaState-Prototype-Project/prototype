/**
 * One-time authorization codes. A used code leaves a tombstone so that a
 * replay is recognised and the access tokens issued from the first exchange
 * can be revoked (RFC 6749 §4.1.2).
 */

import { randomBytes } from "node:crypto";
import type { AuthorizationRequest, Identity } from "../types.js";

export interface CodeRecord extends AuthorizationRequest {
    identity: Identity;
}

interface Entry {
    record: CodeRecord;
    expiresAt: number;
    used: boolean;
    accessTokens: string[];
    /** When the tombstone of a used code may be forgotten. */
    forgetAt: number;
}

export type CodeConsumption =
    | { status: "ok"; record: CodeRecord }
    | { status: "replayed"; accessTokens: string[] }
    | { status: "invalid" };

export class CodeStore {
    private readonly codes = new Map<string, Entry>();

    /**
     * @param ttlMs how long a code may be exchanged
     * @param tombstoneMs how long a used code is remembered, which should
     *   cover the lifetime of the access tokens issued from it
     */
    constructor(
        private readonly ttlMs: number,
        private readonly tombstoneMs: number,
    ) {}

    issue(record: CodeRecord, now: number): string {
        const code = randomBytes(32).toString("base64url");
        const expiresAt = now + this.ttlMs;
        this.codes.set(code, {
            record,
            expiresAt,
            used: false,
            accessTokens: [],
            forgetAt: expiresAt + this.tombstoneMs,
        });
        return code;
    }

    /** Burns the code whatever happens next; it can never be used again. */
    consume(code: string, now: number): CodeConsumption {
        const entry = this.codes.get(code);
        if (!entry) return { status: "invalid" };
        if (entry.used) {
            const accessTokens = entry.accessTokens;
            entry.accessTokens = [];
            return { status: "replayed", accessTokens };
        }
        entry.used = true;
        entry.forgetAt = Math.max(entry.forgetAt, now + this.tombstoneMs);
        if (now >= entry.expiresAt) return { status: "invalid" };
        return { status: "ok", record: entry.record };
    }

    /** Remembers an access token issued from `code`, for replay revocation. */
    recordAccessToken(code: string, token: string): void {
        this.codes.get(code)?.accessTokens.push(token);
    }

    sweep(now: number): void {
        for (const [code, entry] of this.codes) {
            if (now >= entry.forgetAt) this.codes.delete(code);
        }
    }

    get size(): number {
        return this.codes.size;
    }
}
