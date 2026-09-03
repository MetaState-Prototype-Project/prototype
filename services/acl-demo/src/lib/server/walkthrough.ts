/**
 * The whole demonstration, as one sequence you click through.
 *
 * It is deliberately linear and deliberately about one record. You meet the
 * people and platforms first, and then Alice's note has its rules rewritten
 * five times while the same handful of parties keep asking for it. That is the
 * only way the interesting half shows up: not "this policy allows that", which
 * a table can say, but "this is the same request as the one two steps ago, and
 * now it is refused".
 *
 * Every beat marked `ask` or `act` really runs. The `_acl` printed beside it is
 * what was actually stored on the record at that moment, the query is what
 * actually went out, and the response is what actually came back.
 */

import { randomUUID } from "node:crypto";
import { type Cast, director, group, load, provisionCast, save, stage } from "./cast";
import {
	type AclBlock,
	type Exchange,
	type Party,
	createRecord,
	execute,
	readRecord,
	removeRecord,
	updateRecord,
} from "./evault";
import { groupOntology, postOntology } from "./ontology";
import { ALL, READ, UPDATE } from "$lib/acl";

type Names = Record<string, string>;
export type Verb = "read" | "update" | "delete";

/** Introduces one member of the cast. Nothing runs. */
interface CastBeat {
	kind: "cast";
	who: string;
	say: string;
}

/** A title card. Nothing runs. */
interface ChapterBeat {
	kind: "chapter";
	title: string;
	say: string;
}

/** Somebody asks the eVault for something. */
interface AskBeat {
	kind: "ask";
	say: string;
	party: string;
	verb: Verb;
	then: string;
}

/** Something changes, so the next ask happens in a different world. */
interface ActBeat {
	kind: "act";
	say: string;
	then: string;
	policy?: (n: Names) => AclBlock;
	members?: (n: Names) => { members: string[]; owner: string };
	/** Writes the note again, after a beat that deleted it. */
	restage?: true;
}

export type Beat = CastBeat | ChapterBeat | AskBeat | ActBeat;

/** Who can do the asking, and how each one identifies itself on the wire. */
export const CHARACTERS: Record<string, { label: string; party: (n: Names) => Party }> = {
	northwind: { label: "Northwind", party: (n) => ({ platform: n.northwind }) },
	halcyon: { label: "Halcyon", party: (n) => ({ platform: n.halcyon }) },
	northwindAsAlice: {
		label: "Northwind, claiming to act for Alice",
		party: (n) => ({ platform: n.northwind, onBehalfOf: n.alice }),
	},
	halcyonAsBob: {
		label: "Halcyon, acting for Bob",
		party: (n) => ({ platform: n.halcyon, onBehalfOf: n.bob }),
	},
	halcyonAsCarol: {
		label: "Halcyon, acting for Carol",
		party: (n) => ({ platform: n.halcyon, onBehalfOf: n.carol }),
	},
};

function block(partial: Partial<AclBlock>): AclBlock {
	return {
		v: 1,
		grants: [],
		denials: { enames: [], conditions: [] },
		default_perms: 0,
		require: [],
		...partial,
	};
}

/**
  * The grant that keeps the note editable.
  *
  * Every policy below carries it, and it is Alice's only power over her own
  * vault — there is no implicit owner override anywhere in this model. Take this
  * one line out of a policy and the note is frozen for good.
  */
const owner = (n: Names) => ({ ename: n.alice, perms: ALL });

export const BEATS: Beat[] = [
	/* ------------------------------------------------------------ the cast */
	{
		kind: "cast",
		who: "alice",
		say: "Alice. Everything you are about to see happens inside her eVault, and it holds exactly one thing: a note she wrote. Owning the vault buys her less than you would expect — there is no owner override anywhere in this model. Whatever Alice can do to her own note, she can do because a policy says so, and you will see that line in every policy on this page.",
	},
	{
		kind: "cast",
		who: "bob",
		say: "Bob. He has an eVault of his own somewhere, but it never comes into this — here he is a name a policy can mention. Chapter two is about him.",
	},
	{
		kind: "cast",
		who: "carol",
		say: "Carol, the same. Remember her — chapter four is hers.",
	},
	{
		kind: "cast",
		who: "northwind",
		say: "Northwind, a platform. It is the one that keeps getting told no, in three different ways, for three different reasons.",
	},
	{
		kind: "cast",
		who: "halcyon",
		say: "Halcyon, the other platform. Same kind of software, different permissions — which is the entire difference between them.",
	},
	{
		kind: "cast",
		who: "circle",
		say: "And the Reading Circle, a group. Bob and Carol are in it. A group has an eVault like anyone else, and its membership lives in a record inside that vault — which is what makes the last chapter possible.",
	},

	/* ------------------------------- one: different parties, different verbs */
	{
		kind: "chapter",
		title: "One — not everyone gets the same key",
		say: "Alice's note is currently written the way every record on the network is written: the legacy `acl: [\"*\"]` array and nothing else, which reports as everything for everybody. The first thing she does is stop that. Permissions are four independent bits in a single byte — READ 1, CREATE 2, UPDATE 4, DELETE 8 — and being let in is a separate question from being able to do anything.",
	},
	{
		kind: "act",
		say: "Alice writes a policy onto the note: everything for herself, read for Northwind, everything for Halcyon.",
		then: "Read the before block first — that is the legacy array reported in the current shape, `default_perms: 15` behind a `require` group with nothing in it. An empty group is an AND over zero conditions, so it always passes. In the after block `require` is `[]` instead, so nobody unnamed is admitted at all. Northwind holds `1`, Halcyon holds `15`, and neither is more named than the other.",
		policy: (n) =>
			block({
				grants: [owner(n), { ename: n.northwind, perms: READ }, { ename: n.halcyon, perms: ALL }],
			}),
	},
	{
		kind: "ask",
		say: "Northwind reads the note.",
		party: "northwind",
		verb: "read",
		then: "Allowed. `1` is READ and reading is what it asked for.",
	},
	{
		kind: "ask",
		say: "Northwind tries to change it.",
		party: "northwind",
		verb: "update",
		then: "Refused — and it is *named in the policy*. A grant decides on its own; it never falls through to `default_perms` looking for something more generous. Being on the list is not an upgrade.",
	},
	{
		kind: "ask",
		say: "Halcyon makes the same edit.",
		party: "halcyon",
		verb: "update",
		then: "Allowed. Same record, same second, same mutation, same shape of request. One byte of difference in the policy.",
	},

	/* -------------------------------------------- two: whose request is this */
	{
		kind: "chapter",
		title: "Two — whose request is this?",
		say: "A platform authenticates as itself. That says nothing about which of its users a request is for, and most requests are for somebody. `X-ON-BEHALF-OF` is where that gets said.",
	},
	{
		kind: "act",
		say: "Alice adds Bob to the policy with read and update, and leaves Halcyon on everything.",
		then: "Halcyon holds `15`. Bob holds `5`. Both are named. Now watch what happens when Halcyon says whose request it is carrying.",
		policy: (n) =>
			block({
				grants: [owner(n), { ename: n.halcyon, perms: ALL }, { ename: n.bob, perms: READ | UPDATE }],
			}),
	},
	{
		kind: "ask",
		say: "Halcyon asks for the note, declaring it is acting for Bob.",
		party: "halcyonAsBob",
		verb: "read",
		then: "Allowed. Note the `X-ON-BEHALF-OF` header on the request — that is Halcyon's own claim, and nothing proves it. The eVault takes Bob as the party anyway, and records Halcyon alongside him.",
	},
	{
		kind: "ask",
		say: "Still acting for Bob, it tries to delete the note.",
		party: "halcyonAsBob",
		verb: "delete",
		then: "Refused — on a note Halcyon holds `15` on. A grant to a user is more specific than a grant to a platform, so it decides alone, and the platform's broader grant is not consulted, not even to top it up. Saying whose request it is can *cost* a platform access.",
	},
	{
		kind: "ask",
		say: "Halcyon drops the header and sends the identical mutation.",
		party: "halcyon",
		verb: "delete",
		then: "`success: true`. Put this request beside the last one: same platform, same mutation, same id, one header apart. The note is gone.",
	},
	{
		kind: "act",
		say: "Alice writes the note again.",
		then: "A new id, and back to the policy this chapter started from. The rest of the walkthrough needs something to be about.",
		restage: true,
	},

	/* ----------------------------------- three: the one you cannot argue with */
	{
		kind: "chapter",
		title: "Three — the one you cannot argue with",
		say: "Everything so far has been about who was named and how specifically. Denials are the exception to all of it.",
	},
	{
		kind: "act",
		say: "Alice grants Northwind everything — and denies it.",
		then: "Both halves are sitting in the same block: a `perms: 15` grant, and the same eName in `denials.enames`. She also opens the note to anyone else at READ, behind an empty `require` group.",
		policy: (n) =>
			block({
				grants: [owner(n), { ename: n.northwind, perms: ALL }],
				denials: { enames: [n.northwind], conditions: [] },
				default_perms: READ,
				require: [[]],
			}),
	},
	{
		kind: "ask",
		say: "Northwind asks for the note.",
		party: "northwind",
		verb: "read",
		then: "Refused, holding a grant to everything. Deny wins with no exceptions — it is the one place specificity does not decide the outcome. This is how an owner shuts out one platform without having to enumerate every platform they trust.",
	},
	{
		kind: "ask",
		say: "Northwind tries again, this time claiming it is acting for Alice.",
		party: "northwindAsAlice",
		verb: "read",
		then: "Still refused — and it named Alice, who owns the vault and holds `15` on this very note. The header is unproven, so it would be a poor lock if it opened one: denials match the platform carrying a request as well as the name written into it.",
	},
	{
		kind: "ask",
		say: "Bob asks for the note through Halcyon, which was never denied.",
		party: "halcyonAsBob",
		verb: "read",
		then: "Allowed — and Bob is not named anywhere in this policy. He gets in at `default_perms` behind the empty `require` group. Nothing was wrong with the header, and nothing was wrong with asking. The policy was about Northwind.",
	},

	/* --------------------------------------------------- four: the list moves */
	{
		kind: "chapter",
		title: "Four — the list moves",
		say: "The last one is the reason any of this is worth building. A policy does not have to name people.",
	},
	{
		kind: "act",
		say: "Alice replaces the policy with a single grant — to the Reading Circle.",
		then: "The block does not mention Bob or Carol. It names the group, and the group is resolved to whoever is in it at the moment a decision gets made.",
		policy: (n) => block({ grants: [owner(n), { ename: n.circle, perms: READ | UPDATE }] }),
	},
	{
		kind: "ask",
		say: "Carol asks for the note.",
		party: "halcyonAsCarol",
		verb: "read",
		then: "Allowed. Carol is in the Circle — the resolved membership is printed above the request, read out of the group's own manifest.",
	},
	{
		kind: "ask",
		say: "Halcyon asks in its own name.",
		party: "halcyon",
		verb: "read",
		then: "Refused. Not named, not in the group, and `require: []` means nobody unnamed is admitted either.",
	},
	{
		kind: "act",
		say: "Carol is taken out of the Reading Circle.",
		then: "One write, to the group's manifest, inside the group's own eVault. Alice's note was not touched. The policy printed here is the same policy as two beats ago.",
		members: (n) => ({ members: [n.bob], owner: n.alice }),
	},
	{
		kind: "ask",
		say: "Carol asks for the note again.",
		party: "halcyonAsCarol",
		verb: "read",
		then: "Refused, under a policy nobody edited. That is what naming a group buys: who may reach something becomes a question about the group, and no policy anywhere has to be rewritten when the answer changes.",
	},
	{
		kind: "act",
		say: "Carol goes back in.",
		then: "The same single write, in reverse.",
		members: (n) => ({ members: [n.bob, n.carol], owner: n.alice }),
	},
	{
		kind: "ask",
		say: "And once more.",
		party: "halcyonAsCarol",
		verb: "read",
		then: "Allowed again, and that is the walkthrough. Four policies, one note, and every answer on the page decided by the JSON printed beside it.",
	},
];

/* ------------------------------------------------------------------ running */

export interface BeatResult {
	index: number;
	kind: "ask" | "act";
	say: string;
	then: string;
	who: string | null;
	verb: Verb | null;
	/** The policy on the note at the moment this beat ran, as stored. */
	policyBefore: string | null;
	/** And after, when the beat changed it. */
	policyAfter: string | null;
	/** Who the group resolved to, before and after, where a group is in play. */
	membersBefore: string[] | null;
	membersAfter: string[] | null;
	endpoint: string | null;
	headers: Record<string, string> | null;
	query: string | null;
	variables: string | null;
	response: string | null;
	verdict: "allowed" | "refused" | "done" | "failed";
	detail: string | null;
	/** Set when a beat replaced the note, so the page can follow the new id. */
	record: string | null;
}

const READ_QUERY = `query Read($id: ID!) {
  metaEnvelope(id: $id) {
    id
    parsed
    _acl {
      v
      default_perms
      grants { ename perms }
      denials { enames }
      require { ontology path op value }
    }
  }
}`;

const UPDATE_QUERY = `mutation Update($id: ID!, $input: MetaEnvelopeInput!) {
  updateMetaEnvelope(id: $id, input: $input) {
    metaEnvelope { id }
    errors { field message code }
  }
}`;

const DELETE_QUERY = `mutation Remove($id: ID!) {
  removeMetaEnvelope(id: $id) {
    deletedId
    success
    errors { message code }
  }
}`;

const json = (value: unknown) => JSON.stringify(value, null, 2);

export function names(cast: Cast): Names {
	return Object.fromEntries(cast.members.map((entry) => [entry.key, entry.ename]));
}

const THE_NOTE = "walkthrough";

/** What Alice's note says. */
const NOTE = "Tuesday. Ask Bob about the thing.";

/** The policy the note is (re)written under, matching where chapter three left off. */
const RESTAGE_POLICY = (n: Names) =>
	block({
		grants: [owner(n), { ename: n.halcyon, perms: ALL }, { ename: n.bob, perms: READ | UPDATE }],
	});

/**
 * The policy in force on the note.
 *
 * Read back with `metaEnvelope` rather than remembered from what was written:
 * the create and update mutations build their response without the policy, so
 * the only place the answer is right is a query.
 */
async function policyOn(cast: Cast, id: string): Promise<string | null> {
	const read = await readRecord(stage(cast), id, director(cast));
	return read.data?._acl ? json(read.data._acl) : null;
}

/** Who the group resolves to, read from its manifest the way a decision reads it. */
async function membersOf(cast: Cast): Promise<string[] | null> {
	if (!cast.groupRecord) return null;
	const read = await readRecord(group(cast), cast.groupRecord, director(cast));
	const parsed = read.data?.parsed as Record<string, unknown> | undefined;
	if (!parsed) return null;
	const people = new Set<string>();
	for (const field of [
		"members",
		"memberIds",
		"participants",
		"participantIds",
		"admins",
		"owner",
	]) {
		const value = parsed[field];
		for (const item of Array.isArray(value) ? value : [value]) {
			if (typeof item === "string" && item.startsWith("@")) people.add(item);
		}
	}
	return [...people];
}

function manifest(cast: Cast, members: string[], owner: string) {
	return {
		eName: group(cast),
		name: "The Reading Circle",
		description: "A group that exists so a policy can name it instead of its members.",
		members,
		admins: [],
		owner,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

const blank = {
	who: null,
	verb: null,
	policyBefore: null,
	policyAfter: null,
	membersBefore: null,
	membersAfter: null,
	endpoint: null,
	headers: null,
	query: null,
	variables: null,
	response: null,
	detail: null,
	record: null,
};

/**
 * Did the eVault allow it?
 *
 * A refusal arrives two ways — a top-level `errors` array when the access guard
 * threw, or an `errors` list inside the payload when a resolver reported one —
 * and a read returning `null` is a third thing again: no record with that id for
 * that eName, which is not a permissions answer at all.
 */
function allowedBy(exchange: Exchange, field: string): { allowed: boolean; detail: string | null } {
	const body = exchange.response as
		| { errors?: Array<{ message?: string }>; data?: Record<string, unknown> }
		| null;
	const top = body?.errors?.[0]?.message;
	if (top) return { allowed: false, detail: top };

	const payload = body?.data?.[field] as
		| { errors?: Array<{ message?: string }> | null; success?: boolean }
		| null
		| undefined;
	if (payload === null || payload === undefined) {
		return { allowed: false, detail: "returned null — no record with that id for this eName" };
	}
	const inner = payload.errors?.[0]?.message;
	if (inner) return { allowed: false, detail: inner };
	if (field === "removeMetaEnvelope" && payload.success === false) {
		return { allowed: false, detail: "the eVault reported success: false" };
	}
	return { allowed: true, detail: null };
}

/** Writes Alice's note, replacing whatever was there. */
export async function writeNote(cast: Cast, policy: AclBlock | null): Promise<Cast> {
	const previous = cast.scratch?.[THE_NOTE];
	if (previous) await removeRecord(stage(cast), previous, director(cast));

	const written = await createRecord(
		stage(cast),
		{
			ontology: await postOntology(),
			payload: {
				id: randomUUID(),
				authorId: stage(cast),
				content: NOTE,
				visibility: "public",
				createdAt: new Date().toISOString(),
			},
			acl: ["*"],
			_acl: policy,
		},
		director(cast),
	);
	if (!written.data) throw new Error(`could not write the note: ${written.error}`);

	const next = { ...cast, scratch: { ...(cast.scratch ?? {}), [THE_NOTE]: written.data.id } };
	await save(next);
	return next;
}

/**
 * Puts the world back to beat zero: the cast exists, the group holds Bob and
 * Carol, and the note is written with no `_acl` so chapter one has something to
 * be about.
 */
export async function reset(): Promise<Cast> {
	let cast = (await load()) ?? (await provisionCast());
	const n = names(cast);

	if (!cast.groupRecord) {
		const written = await createRecord(
			group(cast),
			{
				ontology: await groupOntology(),
				payload: manifest(cast, [n.bob, n.carol], n.alice),
				acl: ["*"],
			},
			director(cast),
		);
		if (!written.data) throw new Error(`could not write the group: ${written.error}`);
		cast = { ...cast, groupRecord: written.data.id };
		await save(cast);
	} else {
		await updateRecord(
			group(cast),
			cast.groupRecord,
			{
				ontology: await groupOntology(),
				payload: manifest(cast, [n.bob, n.carol], n.alice),
				acl: ["*"],
			},
			director(cast),
		);
	}

	return writeNote(cast, null);
}

/** Runs one beat, for real, and reports everything that crossed the wire. */
export async function runBeat(cast: Cast, index: number): Promise<BeatResult> {
	const beat = BEATS[index];
	if (!beat) throw new Error(`there is no beat ${index}`);
	if (beat.kind === "cast" || beat.kind === "chapter") {
		throw new Error("that beat is narration; it does not run");
	}

	const n = names(cast);
	const id = cast.scratch?.[THE_NOTE];
	if (!id) throw new Error("the note has not been written");

	const base = { index, kind: beat.kind, say: beat.say, then: beat.then };

	if (beat.kind === "act") {
		if (beat.restage) {
			const next = await writeNote(cast, RESTAGE_POLICY(n));
			const fresh = next.scratch![THE_NOTE];
			return {
				...base,
				...blank,
				policyAfter: await policyOn(next, fresh),
				record: fresh,
				verdict: "done",
			};
		}

		if (beat.policy) {
			const [before, current] = await Promise.all([
				policyOn(cast, id),
				readRecord(stage(cast), id, director(cast)),
			]);
			const result = await updateRecord(
				stage(cast),
				id,
				{
					ontology: await postOntology(),
					payload: (current.data?.parsed as Record<string, unknown>) ?? {},
					acl: ["*"],
					_acl: beat.policy(n),
				},
				director(cast),
			);
			return {
				...base,
				...blank,
				policyBefore: before,
				policyAfter: await policyOn(cast, id),
				verdict: result.allowed ? "done" : "failed",
				detail: result.error,
			};
		}

		const wanted = beat.members!(n);
		const before = await membersOf(cast);
		const result = await updateRecord(
			group(cast),
			cast.groupRecord!,
			{
				ontology: await groupOntology(),
				payload: manifest(cast, wanted.members, wanted.owner),
				acl: ["*"],
			},
			director(cast),
		);
		return {
			...base,
			...blank,
			// Printed precisely because it does not change.
			policyBefore: await policyOn(cast, id),
			membersBefore: before,
			membersAfter: await membersOf(cast),
			verdict: result.allowed ? "done" : "failed",
			detail: result.error,
		};
	}

	const character = CHARACTERS[beat.party];
	const party = character.party(n);

	// Fetched together rather than one after another. Each is a round trip to a
	// remote eVault, and by the later chapters they are slow enough that doing
	// them in sequence is the difference between a beat landing and a pause.
	// The membership is thrown away unless a group is what decides.
	const [policyBefore, resolved, current] = await Promise.all([
		policyOn(cast, id),
		membersOf(cast),
		beat.verb === "update"
			? readRecord(stage(cast), id, director(cast))
			: Promise.resolve(null),
	]);
	const membersBefore = policyBefore?.includes(n.circle) ? resolved : null;

	let exchange: Exchange;
	let field: string;
	if (beat.verb === "read") {
		field = "metaEnvelope";
		exchange = await execute(stage(cast), party, READ_QUERY, { id });
	} else if (beat.verb === "update") {
		field = "updateMetaEnvelope";
		const parsed = (current?.data?.parsed as Record<string, unknown>) ?? {};
		exchange = await execute(stage(cast), party, UPDATE_QUERY, {
			id,
			input: {
				ontology: await postOntology(),
				// No `_acl` is sent, so the stored policy is left alone. A beat that
				// rewrote the rules while claiming to edit the content would be lying.
				payload: { ...parsed, updatedAt: new Date().toISOString() },
				acl: ["*"],
			},
		});
	} else {
		field = "removeMetaEnvelope";
		exchange = await execute(stage(cast), party, DELETE_QUERY, { id });
	}

	const { allowed, detail } = allowedBy(exchange, field);

	return {
		...base,
		...blank,
		who: character.label,
		verb: beat.verb,
		policyBefore,
		membersBefore,
		endpoint: exchange.endpoint,
		headers: exchange.headers,
		query: exchange.request.query,
		variables: json(exchange.request.variables),
		response: json(exchange.response),
		verdict: allowed ? "allowed" : "refused",
		detail,
	};
}
