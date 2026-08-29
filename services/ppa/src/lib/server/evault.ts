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
