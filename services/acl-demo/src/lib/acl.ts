/**
 * The wire shape of a policy, shared by the server and the pages.
 *
 * Kept out of `$lib/server` deliberately: SvelteKit refuses a client import
 * from there, and the pages need to name these types.
 */

export interface AclGrant {
	ename: string;
	perms: number;
}

export interface AclCondition {
	ontology: string;
	path: string;
	op: string;
	value: number;
}

export interface AclBlock {
	v?: number;
	grants: AclGrant[];
	denials: { enames: string[]; conditions: AclCondition[] };
	default_perms: number;
	require: AclCondition[][];
}

/** The permission bits, as a single unsigned byte. Bits 4-7 are reserved. */
export const READ = 0x01;
export const CREATE = 0x02;
export const UPDATE = 0x04;
export const DELETE = 0x08;
export const ALL = 0x0f;

/** `0x05` reads as "READ + UPDATE" rather than as a number. */
export function describePerms(perms: number): string {
	if (perms === 0) return "no grant";
	const names: Array<[number, string]> = [
		[READ, "READ"],
		[CREATE, "CREATE"],
		[UPDATE, "UPDATE"],
		[DELETE, "DELETE"],
	];
	const held = names.filter(([bit]) => (perms & bit) !== 0).map(([, name]) => name);
	const reserved = (perms & 0xf0) !== 0 ? " + reserved bits (would be rejected)" : "";
	return `${held.join(" + ") || "none"}${reserved}`;
}
