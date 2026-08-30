/**
 * Write side: a decision is stored in the eVault of the platform it is about.
 *
 * There is no database and no association-owned eVault. The association's
 * identity is its signing key — every decision carries a JWS anyone can verify
 * against /.well-known/jwks.json — so the record itself belongs with the
 * platform it describes, published openly for anyone to read.
 *
 * Reading them back goes through AaaS by ontology id (see aaas.ts), which is a
 * single small query rather than a scan.
 */

import axios from "axios";
import { GraphQLClient, gql } from "graphql-request";
import { registryUrl } from "./env";
import {
    type Accreditation,
    PLATFORM_ACCREDITATION_ONTOLOGY,
} from "./ontology";

const BINDING_DOCUMENTS_QUERY = gql`
    query GetBindingDocuments($first: Int!, $after: String) {
        bindingDocuments(first: $first, after: $after) {
            edges {
                node {
                    id
                    parsed
                }
            }
            pageInfo {
                hasNextPage
                endCursor
            }
        }
    }
`;

const CREATE_META_ENVELOPE = gql`
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

export interface BindingDocument {
    id: string;
    subject: string;
    type: string;
    data: Record<string, unknown>;
    signatures: Array<{ signer: string; signature: string; timestamp: string }>;
}

interface BindingDocumentsResponse {
    bindingDocuments: {
        edges: Array<{
            node: { id: string; parsed: Record<string, unknown> | null };
        }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
}

interface CreateResponse {
    createMetaEnvelope: {
        metaEnvelope: { id: string } | null;
        errors: Array<{ field: string | null; message: string }> | null;
    };
}

let platformToken: string | null = null;
const evaultUrls = new Map<string, string>();

export function normalizeEName(value: string): string {
    return value.startsWith("@") ? value : `@${value}`;
}

/**
 * The registry mints a platform token for any name, and eVault grants a valid
 * platform token access to any vault — which is what lets the association
 * publish its decision into the platform's own eVault.
 */
async function getPlatformToken(): Promise<string> {
    if (platformToken) return platformToken;
    const endpoint = new URL(
        "/platforms/certification",
        registryUrl(),
    ).toString();
    const { data } = await axios.post<{ token: string }>(
        endpoint,
        { platform: "ppa" },
        { timeout: 10_000 },
    );
    platformToken = data.token;
    return platformToken;
}

async function resolveEVaultUrl(ename: string): Promise<string> {
    const cached = evaultUrls.get(ename);
    if (cached) return cached;
    const endpoint = new URL(
        `/resolve?w3id=${encodeURIComponent(ename)}`,
        registryUrl(),
    ).toString();
    const { data } = await axios.get<{ evaultUrl?: string; uri?: string }>(
        endpoint,
        { timeout: 10_000 },
    );
    const resolved = data?.evaultUrl || data?.uri;
    if (!resolved) throw new Error(`Registry did not resolve ${ename}`);
    evaultUrls.set(ename, resolved);
    return resolved;
}

/**
 * Every binding document held by one eName — the identity evidence behind an
 * accountable actor. Reads need a platform token because a person's binding
 * documents are ACL'd to them; deployment documents are the only public ones.
 *
 * Mirrors platforms/enotary/src/lib/server/evault.ts, which reads the same
 * documents to name the counterparty of a social connection.
 */
export async function fetchBindingDocuments(
    ename: string,
): Promise<BindingDocument[]> {
    const normalized = normalizeEName(ename);
    const [baseUrl, token] = await Promise.all([
        resolveEVaultUrl(normalized),
        getPlatformToken(),
    ]);

    const client = new GraphQLClient(new URL("/graphql", baseUrl).toString(), {
        headers: { Authorization: `Bearer ${token}`, "X-ENAME": normalized },
    });

    const out: BindingDocument[] = [];
    let after: string | null = null;
    do {
        const res: BindingDocumentsResponse =
            await client.request<BindingDocumentsResponse>(
                BINDING_DOCUMENTS_QUERY,
                { first: 100, after: after ?? undefined },
            );
        for (const edge of res.bindingDocuments.edges) {
            const parsed = edge.node.parsed;
            if (!parsed || typeof parsed !== "object") continue;
            const { subject, type, data, signatures } = parsed as Record<
                string,
                unknown
            >;
            if (
                typeof subject !== "string" ||
                typeof type !== "string" ||
                typeof data !== "object" ||
                data === null ||
                !Array.isArray(signatures)
            ) {
                continue;
            }
            out.push({
                id: edge.node.id,
                subject,
                type,
                data: data as Record<string, unknown>,
                signatures: signatures as BindingDocument["signatures"],
            });
        }
        after = res.bindingDocuments.pageInfo.hasNextPage
            ? res.bindingDocuments.pageInfo.endCursor
            : null;
    } while (after !== null);

    return out;
}

/**
 * Writes one decision into the reviewed platform's eVault, with a public ACL
 * so the platform, the marketplace and anyone else can read and verify it.
 */
export async function storeAccreditation(
    accreditation: Accreditation,
): Promise<string> {
    const ename = normalizeEName(accreditation.platformEName);
    const [baseUrl, token] = await Promise.all([
        resolveEVaultUrl(ename),
        getPlatformToken(),
    ]);

    const client = new GraphQLClient(new URL("/graphql", baseUrl).toString(), {
        headers: { Authorization: `Bearer ${token}`, "X-ENAME": ename },
    });

    const response = await client.request<CreateResponse>(
        CREATE_META_ENVELOPE,
        {
            input: {
                ontology: PLATFORM_ACCREDITATION_ONTOLOGY,
                payload: accreditation,
                acl: ["*"],
            },
        },
    );

    const errors = response.createMetaEnvelope.errors ?? [];
    if (errors.length > 0) {
        throw new Error(
            `eVault rejected the decision: ${errors
                .map((e) => `${e.field ?? "?"}: ${e.message}`)
                .join("; ")}`,
        );
    }
    const id = response.createMetaEnvelope.metaEnvelope?.id;
    if (!id) throw new Error("eVault returned no MetaEnvelope id");
    return id;
}
