import axios from "axios";
import { GraphQLClient, gql } from "graphql-request";
import { env } from "$env/dynamic/private";
import { PUBLIC_REGISTRY_URL } from "$env/static/public";
import type { BindingDocument, SocialConnection } from "./types";

const BINDING_DOCUMENTS_QUERY = gql`
    query GetBindingDocuments($first: Int!) {
        bindingDocuments(first: $first) {
            edges {
                node {
                    id
                    parsed
                }
            }
        }
    }
`;

const USER_PROFILE_QUERY = gql`
    query GetUserProfile($ontologyId: ID!, $first: Int!) {
        metaEnvelopes(filter: { ontologyId: $ontologyId }, first: $first) {
            edges {
                node {
                    parsed
                }
            }
        }
    }
`;

const USER_PROFILE_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

interface RegistryResolveResponse {
    evaultUrl?: string;
    uri?: string;
}

interface PlatformCertificationResponse {
    token: string;
}

interface BindingDocumentsResponse {
    bindingDocuments: {
        edges: Array<{
            node: {
                id: string;
                parsed: Record<string, unknown> | null;
            };
        }>;
    };
}

class EvaultService {
    private platformToken: string | null = null;
    private profileNameCache = new Map<string, string>();

    private getRegistryUrl(): string {
        const registryUrl = env.REGISTRY_URL || env.PUBLIC_REGISTRY_URL || PUBLIC_REGISTRY_URL;
        if (!registryUrl) throw new Error("REGISTRY_URL or PUBLIC_REGISTRY_URL is required");
        return registryUrl;
    }

    private getGraphqlUrl(evaultBaseUrl: string): string {
        return new URL("/graphql", evaultBaseUrl).toString();
    }

    normalizeEName(value: string): string {
        return value.startsWith("@") ? value : `@${value}`;
    }

    private async getPlatformToken(): Promise<string> {
        if (this.platformToken) return this.platformToken;
        const endpoint = new URL("/platforms/certification", this.getRegistryUrl()).toString();
        const response = await axios.post<PlatformCertificationResponse>(
            endpoint,
            { platform: "enotary" },
            { timeout: 10_000 },
        );
        this.platformToken = response.data.token;
        return this.platformToken;
    }

    async resolveEVaultUrl(eName: string): Promise<string> {
        const normalized = this.normalizeEName(eName);
        const endpoint = new URL(
            `/resolve?w3id=${encodeURIComponent(normalized)}`,
            this.getRegistryUrl(),
        ).toString();
        const response = await axios.get<RegistryResolveResponse>(endpoint, {
            timeout: 10_000,
        });
        const resolved = response.data?.evaultUrl || response.data?.uri;
        if (!resolved) {
            throw new Error("Registry did not return an eVault URL");
        }
        return resolved;
    }

    private async resolveDisplayNameForEName(eName: string): Promise<string> {
        const normalized = this.normalizeEName(eName);
        const cached = this.profileNameCache.get(normalized);
        if (cached) return cached;

        const [evaultBaseUrl, token] = await Promise.all([
            this.resolveEVaultUrl(normalized),
            this.getPlatformToken(),
        ]);

        const client = new GraphQLClient(this.getGraphqlUrl(evaultBaseUrl), {
            headers: {
                Authorization: `Bearer ${token}`,
                "X-ENAME": normalized,
            },
        });

        const response = await client.request<{
            metaEnvelopes?: {
                edges?: Array<{ node?: { parsed?: Record<string, unknown> | null } }>;
            };
        }>(USER_PROFILE_QUERY, {
            ontologyId: USER_PROFILE_ONTOLOGY,
            first: 1,
        });

        const profile = response.metaEnvelopes?.edges?.[0]?.node?.parsed;
        const displayName =
            (typeof profile?.displayName === "string" && profile.displayName) ||
            (typeof profile?.name === "string" && profile.name) ||
            normalized;

        this.profileNameCache.set(normalized, displayName);
        return displayName;
    }

    async fetchBindingDocuments(eName: string): Promise<{
        eName: string;
        documents: BindingDocument[];
        socialConnections: SocialConnection[];
    }> {
        const normalized = this.normalizeEName(eName);
        const [evaultBaseUrl, token] = await Promise.all([
            this.resolveEVaultUrl(normalized),
            this.getPlatformToken(),
        ]);

        const client = new GraphQLClient(this.getGraphqlUrl(evaultBaseUrl), {
            headers: {
                Authorization: `Bearer ${token}`,
                "X-ENAME": normalized,
            },
        });

        const response = await client.request<BindingDocumentsResponse>(
            BINDING_DOCUMENTS_QUERY,
            { first: 100 },
        );

        const documents: BindingDocument[] = response.bindingDocuments.edges
            .map((edge) => {
                const parsed = edge.node.parsed;
                if (!parsed || typeof parsed !== "object") return null;
                const { subject, type, data, signatures } = parsed;
                if (
                    typeof subject !== "string" ||
                    typeof type !== "string" ||
                    typeof data !== "object" ||
                    data === null ||
                    !Array.isArray(signatures)
                ) {
                    return null;
                }
                return {
                    id: edge.node.id,
                    subject,
                    type: type as BindingDocument["type"],
                    data: data as Record<string, unknown>,
                    signatures: signatures as BindingDocument["signatures"],
                };
            })
            .filter((doc): doc is BindingDocument => doc !== null);

        const socialCandidates = documents.filter(
            (doc) => doc.type === "social_connection" && doc.signatures.length === 2,
        );

        const socialConnections = (
            await Promise.all(
                socialCandidates.map(async (doc) => {
                    const otherPartyEName = doc.signatures.find(
                        (signature) => signature.signer !== normalized,
                    )?.signer;

                    if (!otherPartyEName) return null;

                    const name = await this.resolveDisplayNameForEName(otherPartyEName);

                    return {
                        id: doc.id,
                        name,
                        witnessEName: otherPartyEName,
                        signatures: doc.signatures,
                    };
                }),
            )
        ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

        return { eName: normalized, documents, socialConnections };
    }

    async setRecoveryPassphrase(eName: string, passphrase: string): Promise<void> {
        const normalized = this.normalizeEName(eName);
        const [evaultBaseUrl, token] = await Promise.all([
            this.resolveEVaultUrl(normalized),
            this.getPlatformToken(),
        ]);
        const endpoint = new URL("/passphrase/set", evaultBaseUrl).toString();
        await axios.post(
            endpoint,
            { passphrase },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "X-ENAME": normalized,
                },
                timeout: 10_000,
            },
        );
    }
}

export const evaultService = new EvaultService();
