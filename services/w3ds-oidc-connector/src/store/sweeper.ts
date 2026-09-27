/** Periodically drops expired sessions, codes and tokens. */

export interface Sweepable {
    sweep(now: number): void;
}

export function startSweeper(
    stores: Sweepable[],
    now: () => number,
    intervalMs = 30_000,
): () => void {
    const timer = setInterval(() => {
        const at = now();
        for (const store of stores) store.sweep(at);
    }, intervalMs);
    timer.unref();
    return () => clearInterval(timer);
}
