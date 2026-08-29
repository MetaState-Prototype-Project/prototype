/**
 * Shared between the decision form and the server that signs it, so this
 * lives outside $lib/server — SvelteKit refuses to bundle server-only modules
 * into a component.
 */

export const ACCESS_LEVELS = ["L1", "L2", "L3", "L4", "L5"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export function isAccessLevel(value: unknown): value is AccessLevel {
    return (
        typeof value === "string" &&
        (ACCESS_LEVELS as readonly string[]).includes(value)
    );
}
