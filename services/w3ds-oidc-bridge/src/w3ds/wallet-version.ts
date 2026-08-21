/**
 * The wallet version gate.
 *
 * Deliberately alone in its own file: the W3DS protocol documentation calls
 * `appVersion` temporary, added because some wallets signed differently, and due
 * to be removed once the rollout finishes. When that happens this file and its
 * one call site go, and nothing else has to be untangled.
 */
export function isWalletVersionAtLeast(
    appVersion: string | undefined,
    minimum: string,
): boolean {
    if (!appVersion) return false;

    const parse = (value: string): number[] =>
        value
            .split(".")
            .slice(0, 3)
            .map((part) => Number.parseInt(part, 10));

    const actual = parse(appVersion);
    const required = parse(minimum);

    for (let i = 0; i < 3; i += 1) {
        // A missing component is zero, so "0.4" means "0.4.0" — the reference
        // implementation the platforms share behaves the same way, and rejecting
        // a valid wallet is worse than accepting a terse version string.
        const a = actual[i] ?? 0;
        const r = required[i] ?? 0;
        // A component that does not parse is not a version. Treating NaN as zero
        // would let "abc" through against a minimum of "0.0.0".
        if (Number.isNaN(a)) return false;
        if (a > r) return true;
        if (a < r) return false;
    }

    return true;
}
