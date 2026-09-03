/**
 * The cast: the identities this demo needs, provisioned once against the live
 * network and then remembered.
 *
 * Everything here is keyless — no wallet, no keys, no KYC. Provisioning accepts
 * a demo verification code and an omitted `publicKey`, which is what platform
 * and group eVaults use in production too. Nothing in an `_acl` decision needs
 * a party to hold keys; it needs a party to have a resolvable eName, and that
 * is all provisioning is being asked for.
 *
 * The stage vault exists so the demo never writes into whoever is running it.
 * Everything the demo creates lives there and nowhere else.
 */

import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { castFile, demoCode, provisionerUrl } from "./env";
import type { Party } from "./evault";
import { entropy } from "./registry";

export interface Member {
	key: string;
	label: string;
	role: "owner" | "user" | "platform" | "group";
	ename: string;
	blurb: string;
}

export interface Cast {
	members: Member[];
	/** MetaEnvelope ids of the seeded records, by their scenario key. */
	records: Record<string, string>;
	/** The group's manifest record, which lives in the group's own vault. */
	groupRecord: string | null;
	/** The record each story owns, so a story that deletes one really can. */
	scratch?: Record<string, string>;
	createdAt: string;
}

/** Who gets provisioned, in order, and why each one is here. */
const ROSTER: Array<Omit<Member, "ename">> = [
	{
		key: "alice",
		label: "Alice",
		role: "owner",
		blurb:
			"The vault every record lives in, and a party in her own right. Both at once, deliberately — an owner has no standing in a decision except the grant she gives herself.",
	},
	{
		key: "bob",
		label: "Bob",
		role: "user",
		blurb: "A user party and a member of the Reading Circle.",
	},
	{
		key: "carol",
		label: "Carol",
		role: "user",
		blurb: "A user party, in the Reading Circle until you take her out of it.",
	},
	{
		key: "northwind",
		label: "Northwind",
		role: "platform",
		blurb: "A platform party. Its eName is the `platform` claim in its registry token.",
	},
	{
		key: "halcyon",
		label: "Halcyon",
		role: "platform",
		blurb: "A second platform, so specificity between two platforms is visible.",
	},
	{
		key: "circle",
		label: "The Reading Circle",
		role: "group",
		blurb: "A group. Its manifest lives in its own vault, which is how eVault finds it.",
	},
	{
		key: "director",
		label: "The demo itself",
		role: "platform",
		blurb:
			"How this app writes. It carries a token like any platform, and asserts the stage as the user it acts for — which is the only reason it can edit a policy at all.",
	},
];

const STATE = Symbol.for("acl-demo.cast");
const store = globalThis as typeof globalThis & { [STATE]?: Cast | null };

/** One keyless eVault. */
async function provision(): Promise<string> {
	const registryEntropy = await entropy();
	const res = await fetch(new URL("/provision", provisionerUrl()), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			registryEntropy,
			namespace: randomUUID(),
			verificationId: demoCode(),
		}),
		signal: AbortSignal.timeout(60_000),
	});
	const body = (await res.json().catch(() => null)) as
		| { success?: boolean; w3id?: string; message?: string; error?: string }
		| null;
	if (!res.ok || !body?.w3id) {
		throw new Error(
			`provisioning failed (${res.status}): ${body?.message ?? body?.error ?? "no w3id returned"}`,
		);
	}
	return body.w3id.startsWith("@") ? body.w3id : `@${body.w3id}`;
}

export async function load(): Promise<Cast | null> {
	if (store[STATE] !== undefined) return store[STATE];
	try {
		const raw = await readFile(castFile(), "utf8");
		store[STATE] = JSON.parse(raw) as Cast;
	} catch {
		store[STATE] = null;
	}
	return store[STATE];
}

export async function save(cast: Cast): Promise<void> {
	store[STATE] = cast;
	await writeFile(castFile(), `${JSON.stringify(cast, null, 2)}\n`, "utf8");
}

/**
 * Provisions the whole cast.
 *
 * Serial rather than parallel: each eVault needs its own entropy token, and the
 * registry hands those out one request at a time.
 */
export async function provisionCast(): Promise<Cast> {
	const members: Member[] = [];
	for (const entry of ROSTER) {
		members.push({ ...entry, ename: await provision() });
	}
	const cast: Cast = {
		members,
		records: {},
		groupRecord: null,
		createdAt: new Date().toISOString(),
	};
	await save(cast);
	return cast;
}

export function member(cast: Cast, key: string): Member {
	const found = cast.members.find((entry) => entry.key === key);
	if (!found) throw new Error(`the cast has no member "${key}"`);
	return found;
}

/** The vault everything is written into. It is Alice's. */
export const stage = (cast: Cast) => member(cast, "alice").ename;
export const group = (cast: Cast) => member(cast, "circle").ename;

/**
 * The party this app acts as when it seeds records and edits policies.
 *
 * Worth being explicit about, because it is the one thing a policy editor
 * cannot take for granted: **the vault owner has no special standing in an
 * `_acl` decision.** There is no implicit owner override. A record whose policy
 * names nobody holding UPDATE cannot be edited by anybody at all, including
 * whoever's vault it sits in.
 *
 * So this app writes as its own platform, asserting Alice as the user it acts
 * for, and every policy it writes grants Alice `0x0F`. That grant is the way
 * back in, and it is the only reason the walkthrough can keep rewriting the
 * note's rules.
 */
export function director(cast: Cast): Party {
	return { platform: member(cast, "director").ename, onBehalfOf: stage(cast) };
}
