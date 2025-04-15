/**
 * Utility function to check if A is subset of B
 *
 * @param a Array to check if it's a subset
 * @param b Array to check against
 * @returns true if every element in 'a' is present in 'b' with at least the same frequency
 * @example
 * isSubsetOf([1, 2], [1, 2, 3]) // returns true
 * isSubsetOf([1, 1, 2], [1, 2, 3]) // returns false (not enough 1's in b)
 * isSubsetOf([], [1, 2]) // returns true (empty set is a subset of any set)
 */

export function isSubsetOf(a: unknown[], b: unknown[]) {
    const map = new Map();

    for (const el of b) {
        map.set(el, (map.get(el) || 0) + 1);
    }

    for (const el of a) {
        if (!map.has(el) || map.get(el) === 0) {
            return false;
        }
        map.set(el, map.get(el) - 1);
    }

    return true;
}
