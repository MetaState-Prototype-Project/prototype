/**
 * Builds the message object components call, layering corrections over the
 * compiled paraglide messages. Kept free of `$lib` and rune imports so the
 * lookup path is unit-testable.
 */

import { fill } from "./catalog";

export type MessageFn = (
    inputs?: Record<string, unknown>,
    options?: { locale?: string },
) => string;

export type Lookup = (locale: string, key: string) => string | undefined;

export function createMessages<T extends object>(
    compiled: T,
    getLocale: () => string,
    lookup: Lookup,
): T {
    // Wrappers are memoised so repeated renders reuse one function per key
    // rather than allocating on every property access.
    const wrapped = new Map<string, MessageFn>();

    return new Proxy({} as T, {
        get(_target, key) {
            if (typeof key !== "string") return undefined;
            const original = (compiled as Record<string, MessageFn>)[key];
            if (!original) return undefined;

            let fn = wrapped.get(key);
            if (!fn) {
                fn = (inputs, options) => {
                    const override = lookup(
                        options?.locale ?? getLocale(),
                        key,
                    );
                    return override === undefined
                        ? original(inputs, options)
                        : fill(override, inputs);
                };
                wrapped.set(key, fn);
            }
            return fn;
        },
    });
}
