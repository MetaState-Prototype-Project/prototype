/**
 * Whether a commit's diff should be inlined into the MetaEnvelope, or replaced
 * with a diffUrl pointer instead. Isolated from the HTTP fetching in diff.ts so
 * the size threshold itself - the boundary condition, in particular - is testable
 * with no network involved.
 *
 * At exactly `maxBytes`, the diff is inlined: the cap is inclusive, matching the
 * ordinary reading of "up to N bytes".
 */
export function shouldInline(diffBytes: number, maxBytes: number): boolean {
    return diffBytes <= maxBytes;
}
