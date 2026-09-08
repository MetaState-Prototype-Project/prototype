import { doc, getDoc } from 'firebase/firestore';
import { usersCollection } from './collections';
import type { User } from '@lib/types/user';

/**
 * Loads participant profiles by eName, with a short-lived cache.
 *
 * A chat names its participants by eName. An eName carries identity but no
 * profile data, so a display name or avatar is a separate read per participant,
 * and every chat surface renders a list of them. Without a cache that is an
 * N+1 on every render, repeated across the chat list, the window, the member
 * list, and the settings panes, all of which show the same handful of people.
 *
 * A Blabsy user document is keyed by the user's eName, so the eName is the
 * document id and no lookup table is needed.
 *
 * Misses are cached too: a participant on a platform this instance knows
 * nothing about is a normal and stable condition, not something to retry on
 * every render.
 */

const TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
    value: User | null;
    expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<User | null>>();

async function loadProfile(ename: string): Promise<User | null> {
    const snapshot = await getDoc(doc(usersCollection, ename));
    return snapshot.exists() ? snapshot.data() : null;
}

/** Resolves one participant, from cache when it is fresh. */
export async function getParticipant(ename: string): Promise<User | null> {
    const cached = cache.get(ename);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    cache.delete(ename);

    const existing = inflight.get(ename);
    if (existing) return existing;

    const pending = loadProfile(ename)
        .then((value) => {
            cache.set(ename, { value, expiresAt: Date.now() + TTL_MS });
            return value;
        })
        .catch((error) => {
            // Not cached: a transient failure should not be remembered for the
            // whole TTL the way a genuine miss is.
            console.warn(`Failed to load profile ${ename}:`, error);
            return null;
        })
        .finally(() => {
            inflight.delete(ename);
        });

    inflight.set(ename, pending);
    return pending;
}

/**
 * Resolves a participant list in parallel, keyed by eName.
 *
 * `self` short-circuits the current user, who is already in hand and is in
 * almost every list. Participants that resolve to nothing are omitted rather
 * than left as holes for the caller to guard.
 */
export async function getParticipants(
    enames: readonly string[],
    self?: User | null
): Promise<Record<string, User>> {
    const unique = Array.from(new Set(enames));

    const entries = await Promise.all(
        unique.map(async (ename) => {
            if (self && ename === self.id) return [ename, self] as const;
            return [ename, await getParticipant(ename)] as const;
        })
    );

    const out: Record<string, User> = {};
    for (const [ename, user] of entries) {
        if (user) out[ename] = user;
    }
    return out;
}

/** Drops a cached profile, for when it is known to have changed. */
export function invalidateParticipant(ename: string): void {
    cache.delete(ename);
}
