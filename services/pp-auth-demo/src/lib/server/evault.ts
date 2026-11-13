/**
 * Reads from real eVaults: the registry resolves an eName to a vault, and a
 * platform token opens it.
 *
 * That token is exactly the bypass PP Auth exists to replace — the registry
 * mints one for any name that asks, and eVault honours it against any vault.
 * This app uses it to *read* evidence that is already public, and says so
 * rather than pretending it has earned the access.
 */

import { GraphQLClient, gql } from "graphql-request";
import { PLATFORM_NAME, registryUrl } from "./env";

const BINDING_DOCUMENTS = gql`
	query BindingDocuments {
		bindingDocuments(first: 50) {
			edges {
				node {
					id
					parsed
				}
			}
		}
	}
`;

const ENVELOPES = gql`
	query Envelopes($ontologyId: ID!, $first: Int!) {
		metaEnvelopes(filter: { ontologyId: $ontologyId }, first: $first) {
			edges {
				node {
					id
					parsed
				}
			}
		}
	}
`;

const CREATE = gql`
	mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
		createMetaEnvelope(input: $input) {
			metaEnvelope {
				id
			}
			errors {
				field
				message
			}
		}
	}
`;

const TOKEN = Symbol.for("pp-auth-demo.platformToken");
const URLS = Symbol.for("pp-auth-demo.evaultUrls");
const store = globalThis as typeof globalThis & {
	[TOKEN]?: Promise<string>;
	[URLS]?: Map<string, string>;
};
store[URLS] ??= new Map();

export function normalizeEName(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "";
	return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

async function platformToken(): Promise<string> {
	store[TOKEN] ??= (async () => {
		const res = await fetch(new URL("/platforms/certification", registryUrl()), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ platform: PLATFORM_NAME }),
			signal: AbortSignal.timeout(15_000),
		});
		if (!res.ok) throw new Error(`registry token request returned ${res.status}`);
		const body = (await res.json()) as { token?: string };
		if (!body.token) throw new Error("registry returned no token");
		return body.token;
	})().catch((error) => {
		// Do not cache a failure: the next request should try again.
		store[TOKEN] = undefined;
		throw error;
	});
	return store[TOKEN];
}

export async function resolveVault(ename: string): Promise<string | null> {
	const normalized = normalizeEName(ename);
	const cached = store[URLS]!.get(normalized);
	if (cached) return cached;
	try {
		const res = await fetch(
			new URL(`/resolve?w3id=${encodeURIComponent(normalized)}`, registryUrl()),
			{ signal: AbortSignal.timeout(15_000) },
		);
		if (!res.ok) return null;
		const body = (await res.json()) as { evaultUrl?: string; uri?: string };
		const url = body.evaultUrl || body.uri;
		if (!url) return null;
		store[URLS]!.set(normalized, url);
		return url;
	} catch {
		return null;
	}
}

async function client(ename: string): Promise<GraphQLClient | null> {
	const normalized = normalizeEName(ename);
	const [url, token] = await Promise.all([
		resolveVault(normalized),
		platformToken(),
	]);
	if (!url) return null;
	return new GraphQLClient(new URL("/graphql", url).toString(), {
		headers: { Authorization: `Bearer ${token}`, "X-ENAME": normalized },
	});
}

export interface RawBindingDocument {
	id: string;
	subject: string;
	type: string;
	data: Record<string, unknown>;
	signatures: Array<Record<string, unknown>>;
}

/** The binding documents held in one eVault. */
export async function bindingDocuments(
	ename: string,
): Promise<RawBindingDocument[]> {
	const gqlClient = await client(ename);
	if (!gqlClient) return [];
	try {
		const res = await gqlClient.request<{
			bindingDocuments: {
				edges: Array<{ node: { id: string; parsed: Record<string, unknown> | null } }>;
			};
		}>(BINDING_DOCUMENTS);
		return res.bindingDocuments.edges
			.map((edge) => {
				const parsed = edge.node.parsed;
				if (!parsed || typeof parsed !== "object") return null;
				return { id: edge.node.id, ...parsed } as RawBindingDocument;
			})
			.filter((doc): doc is RawBindingDocument => doc !== null);
	} catch (error) {
		console.warn(`[pp-auth-demo] could not read binding documents for ${ename}:`, error);
		return [];
	}
}

/** MetaEnvelopes of one ontology held in one eVault. */
export async function envelopes(
	ename: string,
	ontologyId: string,
	first = 25,
): Promise<Array<{ id: string; parsed: Record<string, unknown> }>> {
	const gqlClient = await client(ename);
	if (!gqlClient) return [];
	try {
		const res = await gqlClient.request<{
			metaEnvelopes: {
				edges: Array<{ node: { id: string; parsed: Record<string, unknown> | null } }>;
			};
		}>(ENVELOPES, { ontologyId, first });
		return res.metaEnvelopes.edges
			.filter((edge) => edge.node.parsed && typeof edge.node.parsed === "object")
			.map((edge) => ({ id: edge.node.id, parsed: edge.node.parsed! }));
	} catch {
		// A vault holding nothing of this ontology errors on some deployments.
		return [];
	}
}

/** Writes one record into an eVault. Used only for the owner's own terms. */
export async function store_(
	ename: string,
	ontologyId: string,
	payload: Record<string, unknown>,
	acl: string[],
): Promise<string> {
	const gqlClient = await client(ename);
	if (!gqlClient) throw new Error(`could not resolve an eVault for ${ename}`);
	const res = await gqlClient.request<{
		createMetaEnvelope: {
			metaEnvelope: { id: string } | null;
			errors: Array<{ message: string }> | null;
		};
	}>(CREATE, { input: { ontology: ontologyId, payload, acl } });
	const errors = res.createMetaEnvelope.errors;
	if (errors?.length) throw new Error(errors.map((e) => e.message).join("; "));
	const id = res.createMetaEnvelope.metaEnvelope?.id;
	if (!id) throw new Error("eVault accepted the write but returned no id");
	return id;
}
