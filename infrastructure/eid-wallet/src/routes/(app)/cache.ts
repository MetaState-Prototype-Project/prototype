/**
 * Registry of the module-scope render caches that survive logout.
 *
 * Pages stash their last-known values at module scope so re-entering paints
 * instantly instead of flashing a spinner. That state outlives logout:
 * `performLogout` leaves with `goto("/")`, a client-side navigation, and
 * SvelteKit never re-evaluates a module on client-side nav. So without an
 * explicit reset, the next user to onboard on this device is shown the
 * previous user's data. Same hazard `clearAllCachedPhotos` exists for.
 *
 * A page registers its own reset from `<script module>`, which keeps the cache
 * colocated with the code that fills it. A page that was never visited never
 * registered — and has nothing cached to leak.
 */
const resets = new Set<() => void>();

/** Register a page's cache reset. Call from `<script module>`. */
export function registerPageCacheReset(reset: () => void): void {
    resets.add(reset);
}

/**
 * Wipe every registered page cache. Call on logout to prevent cross-user data
 * leaks.
 */
export function clearAllPageCaches(): void {
    for (const reset of resets) reset();
}
