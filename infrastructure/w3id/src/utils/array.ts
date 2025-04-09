/**
 * Utility function to check if A is subset of B
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
