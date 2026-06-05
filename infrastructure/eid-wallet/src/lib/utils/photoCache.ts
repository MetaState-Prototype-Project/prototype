/**
 * Photo blob cache backed by localForage (IndexedDB → WebSQL → localStorage,
 * in that preference order). Photos are base64 strings that can be several MB
 * each, so IndexedDB is the right driver — no 5 MB cap unlike plain localStorage.
 *
 * Each entry is keyed by metaEnvelopeId so individual photos can be
 * invalidated on delete or edit without touching the rest of the store.
 *
 * All operations are non-fatal: if storage is unavailable the functions
 * silently no-op or return []. The network is always the source of truth;
 * this cache only accelerates subsequent loads.
 */

import localforage from "localforage";

export interface CachedPhoto {
    metaEnvelopeId: string;
    dataUrl: string;
    description: string;
}

const store = localforage.createInstance({
    name: "eid-wallet",
    storeName: "photo-cache",
    description: "Personal binding photo blobs",
});

/** Return every cached photo. Returns [] if the cache is empty or unavailable. */
export async function getAllCachedPhotos(): Promise<CachedPhoto[]> {
    try {
        const photos: CachedPhoto[] = [];
        await store.iterate<CachedPhoto, void>((value) => {
            photos.push(value);
        });
        return photos;
    } catch {
        return [];
    }
}

/** Insert or update a single photo entry. */
export async function setCachedPhoto(photo: CachedPhoto): Promise<void> {
    try {
        await store.setItem(photo.metaEnvelopeId, photo);
    } catch {
        // non-fatal
    }
}

/** Remove a single photo entry by id. */
export async function deleteCachedPhoto(metaEnvelopeId: string): Promise<void> {
    try {
        await store.removeItem(metaEnvelopeId);
    } catch {
        // non-fatal
    }
}

/**
 * Atomically replace the entire cache with a fresh set of photos.
 * Called after a successful server fetch so the cache always reflects
 * the authoritative server state.
 */
export async function replaceAllCachedPhotos(
    photos: CachedPhoto[],
): Promise<void> {
    try {
        await store.clear();
        await Promise.all(photos.map((p) => store.setItem(p.metaEnvelopeId, p)));
    } catch {
        // non-fatal
    }
}
