const ENABLED = process.env.EVAULT_TIMING !== "0";
const SLOW_MS =
    process.env.EVAULT_TIMING_SLOW_MS !== undefined
        ? Number(process.env.EVAULT_TIMING_SLOW_MS)
        : 50;

let counter = 0;
export function newTraceId(prefix = "t"): string {
    counter = (counter + 1) % 1_000_000;
    return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

export async function timed<T>(
    label: string,
    fn: () => Promise<T>,
    traceId?: string,
): Promise<T> {
    if (!ENABLED) return fn();
    const start = performance.now();
    try {
        const result = await fn();
        const ms = performance.now() - start;
        if (ms >= SLOW_MS) {
            console.log(
                `[timing]${traceId ? ` ${traceId}` : ""} ${label} ${ms.toFixed(1)}ms`,
            );
        }
        return result;
    } catch (err) {
        const ms = performance.now() - start;
        console.log(
            `[timing]${traceId ? ` ${traceId}` : ""} ${label} ${ms.toFixed(1)}ms (failed)`,
        );
        throw err;
    }
}

export function timingEnabled(): boolean {
    return ENABLED;
}
