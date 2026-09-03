/**
 * eVault GraphQL, as a chosen party.
 *
 * Who a request *is* comes from two headers and one token claim, and the whole
 * demo turns on getting them right:
 *
 *   Authorization: Bearer <token whose `platform` claim is the platform eName>
 *   X-ENAME:        the vault being addressed
 *   X-ON-BEHALF-OF: the user the platform declares it is acting for
 *
 * With the header, that user is the party at user specificity and the platform
 * is recorded alongside it. Without it, the platform is the party. The header
 * is an assertion and not a proof — which is exactly why a denial matches the
 * carrying platform too.
 */

import { GraphQLClient, gql } from "graphql-request";
import type { AclBlock } from "$lib/acl";
import { normalizeEName, platformToken, resolveVault } from "./registry";

export type { AclBlock, AclGrant, AclCondition } from "$lib/acl";

export interface Party {
	/** The platform whose token carries the request. */
	platform: string;
	/** The user it declares it is acting for, if any. */
	onBehalfOf?: string | null;
}

const METAENVELOPE = gql`
	query MetaEnvelope($id: ID!) {
		metaEnvelope(id: $id) {
			id
			ontology
			parsed
			_acl {
				v
				default_perms
				grants { ename perms }
				denials { enames conditions { ontology path op value } }
				require { ontology path op value }
			}
		}
	}
`;

const LIST = gql`
	query MetaEnvelopes($ontologyId: ID!, $first: Int!) {
		metaEnvelopes(filter: { ontologyId: $ontologyId }, first: $first) {
			edges { node { id parsed } }
			totalCount
		}
	}
`;

const CREATE = gql`
	mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
		createMetaEnvelope(input: $input) {
			metaEnvelope { id }
			errors { field message code }
		}
	}
`;

const UPDATE = gql`
	mutation UpdateMetaEnvelope($id: ID!, $input: MetaEnvelopeInput!) {
		updateMetaEnvelope(id: $id, input: $input) {
			metaEnvelope { id }
			errors { field message code }
		}
	}
`;

const REMOVE = gql`
	mutation RemoveMetaEnvelope($id: ID!) {
		removeMetaEnvelope(id: $id) {
			deletedId
			success
			errors { message code }
		}
	}
`;

async function client(vault: string, party: Party): Promise<GraphQLClient> {
	const ename = normalizeEName(vault);
	const [url, token] = await Promise.all([
		resolveVault(ename),
		platformToken(party.platform),
	]);
	if (!url) throw new Error(`could not resolve an eVault for ${ename}`);

	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		"X-ENAME": ename,
	};
	if (party.onBehalfOf) {
		headers["X-ON-BEHALF-OF"] = normalizeEName(party.onBehalfOf);
	}
	return new GraphQLClient(new URL("/graphql", url).toString(), { headers });
}

/**
 * The shape every demo request reports back.
 *
 * A refusal is an outcome, not a failure, so it is returned rather than thrown
 * — the point of the exercise is to show which requests are refused.
 */
export interface Attempt<T> {
	allowed: boolean;
	/** eVault's own words when it refused. */
	error: string | null;
	data: T | null;
}

function message(error: unknown): string {
	if (error && typeof error === "object" && "response" in error) {
		const response = (error as { response?: { errors?: Array<{ message?: string }> } })
			.response;
		const first = response?.errors?.[0]?.message;
		if (first) return first;
	}
	return error instanceof Error ? error.message : String(error);
}

export interface Envelope {
	id: string;
	ontology?: string;
	parsed: Record<string, unknown> | null;
	_acl: AclBlock | null;
}

export async function readRecord(
	vault: string,
	id: string,
	party: Party,
): Promise<Attempt<Envelope>> {
	try {
		const gqlClient = await client(vault, party);
		const res = await gqlClient.request<{ metaEnvelope: Envelope | null }>(
			METAENVELOPE,
			{ id },
		);
		// A record that does not exist for this vault is null, which is not a
		// refusal — the two are deliberately distinguishable.
		return { allowed: true, error: null, data: res.metaEnvelope };
	} catch (error) {
		return { allowed: false, error: message(error), data: null };
	}
}

export async function listRecords(
	vault: string,
	ontologyId: string,
	party: Party,
	first = 50,
): Promise<Attempt<{ ids: string[]; totalCount: number }>> {
	try {
		const gqlClient = await client(vault, party);
		const res = await gqlClient.request<{
			metaEnvelopes: {
				edges: Array<{ node: { id: string } }>;
				totalCount: number;
			};
		}>(LIST, { ontologyId, first });
		return {
			allowed: true,
			error: null,
			data: {
				ids: res.metaEnvelopes.edges.map((edge) => edge.node.id),
				totalCount: res.metaEnvelopes.totalCount,
			},
		};
	} catch (error) {
		return { allowed: false, error: message(error), data: null };
	}
}

export interface WriteInput {
	ontology: string;
	payload: Record<string, unknown>;
	acl: string[];
	_acl?: AclBlock | null;
}

export async function createRecord(
	vault: string,
	input: WriteInput,
	party: Party,
): Promise<Attempt<{ id: string }>> {
	try {
		const gqlClient = await client(vault, party);
		const res = await gqlClient.request<{
			createMetaEnvelope: {
				metaEnvelope: { id: string } | null;
				errors: Array<{ message: string }> | null;
			};
		}>(CREATE, { input: sanitize(input) });
		const errors = res.createMetaEnvelope.errors;
		if (errors?.length) {
			return { allowed: false, error: errors.map((e) => e.message).join("; "), data: null };
		}
		const id = res.createMetaEnvelope.metaEnvelope?.id;
		if (!id) return { allowed: false, error: "accepted but returned no id", data: null };
		return { allowed: true, error: null, data: { id } };
	} catch (error) {
		return { allowed: false, error: message(error), data: null };
	}
}

export async function updateRecord(
	vault: string,
	id: string,
	input: WriteInput,
	party: Party,
): Promise<Attempt<{ id: string }>> {
	try {
		const gqlClient = await client(vault, party);
		const res = await gqlClient.request<{
			updateMetaEnvelope: {
				metaEnvelope: { id: string } | null;
				errors: Array<{ message: string }> | null;
			};
		}>(UPDATE, { id, input: sanitize(input) });
		const errors = res.updateMetaEnvelope.errors;
		if (errors?.length) {
			return { allowed: false, error: errors.map((e) => e.message).join("; "), data: null };
		}
		return { allowed: true, error: null, data: { id } };
	} catch (error) {
		return { allowed: false, error: message(error), data: null };
	}
}

export async function removeRecord(
	vault: string,
	id: string,
	party: Party,
): Promise<Attempt<{ deletedId: string }>> {
	try {
		const gqlClient = await client(vault, party);
		const res = await gqlClient.request<{
			removeMetaEnvelope: {
				deletedId: string | null;
				success: boolean;
				errors: Array<{ message: string }> | null;
			};
		}>(REMOVE, { id });
		const errors = res.removeMetaEnvelope.errors;
		if (errors?.length) {
			return { allowed: false, error: errors.map((e) => e.message).join("; "), data: null };
		}
		return {
			allowed: res.removeMetaEnvelope.success,
			error: res.removeMetaEnvelope.success ? null : "refused",
			data: { deletedId: res.removeMetaEnvelope.deletedId ?? id },
		};
	} catch (error) {
		return { allowed: false, error: message(error), data: null };
	}
}

/**
 * `_acl` is omitted rather than sent as null when there is none.
 *
 * An update that does not carry `_acl` leaves the stored policy alone, which is
 * how the demo shows a content edit preserving a policy.
 */
function sanitize(input: WriteInput): Record<string, unknown> {
	const { _acl, ...rest } = input;
	return _acl ? { ...rest, _acl } : rest;
}

/* ------------------------------------------------------------- raw exchange */

export interface Exchange {
	endpoint: string;
	/**
	 * The headers that identify the party.
	 *
	 * `Authorization` is sent but deliberately not reported. Every request here
	 * carries one and it is the same kind of thing every time, so printing it in
	 * each step would be noise sitting on top of the two headers that actually
	 * decide anything.
	 */
	headers: Record<string, string>;
	request: { query: string; variables: Record<string, unknown> };
	response: unknown;
	status: number;
}

/**
 * One GraphQL call, with the wire kept.
 *
 * `graphql-request` is fine when only the data matters, but a demonstration is
 * mostly about what went out and what came back — so this goes through `fetch`
 * and hands both back untouched.
 */
export async function execute(
	vault: string,
	party: Party,
	query: string,
	variables: Record<string, unknown>,
): Promise<Exchange> {
	const ename = normalizeEName(vault);
	const [url, token] = await Promise.all([
		resolveVault(ename),
		platformToken(party.platform),
	]);
	if (!url) throw new Error(`could not resolve an eVault for ${ename}`);

	const shown: Record<string, string> = { "X-ENAME": ename };
	if (party.onBehalfOf) shown["X-ON-BEHALF-OF"] = normalizeEName(party.onBehalfOf);

	const endpoint = new URL("/graphql", url).toString();
	const res = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
			...shown,
		},
		body: JSON.stringify({ query, variables }),
		signal: AbortSignal.timeout(30_000),
	});

	return {
		endpoint,
		headers: shown,
		request: { query, variables },
		response: await res.json().catch(() => null),
		status: res.status,
	};
}
