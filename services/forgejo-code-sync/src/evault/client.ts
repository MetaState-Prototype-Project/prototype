import { GraphQLClient } from "graphql-request";

/**
 * Minted for this service - see services/ontology/schemas/codeCommit.json.
 * No registration step beyond that file existing; the ontology service loads
 * every schema in that directory at startup.
 */
export const CODE_COMMIT_ONTOLOGY_ID = "af7b8ea0-365c-414b-8dbb-5c0cdd6a46b8";

const CREATE_MUTATION = `
  mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
    createMetaEnvelope(input: $input) {
      metaEnvelope {
        id
      }
      errors { field message code }
    }
  }
`;

export interface CommitEnvelopePayload {
    id: string;
    repo: string;
    ref: string;
    message: string;
    authorEName: string;
    committedAt: string;
    added: string[];
    removed: string[];
    modified: string[];
    diff: string | null;
    diffUrl: string | null;
}

interface PlatformTokenResponse {
    token: string;
    expiresAt?: number;
}

export interface EVaultClientOptions {
    registryUrl: string;
    evaultServerUri: string;
    /** This service's own public base URL, presented to the Registry for certification. */
    publicUrl: string;
    fetchImpl?: typeof fetch;
}

/**
 * Certify-then-per-eName-GraphQL-client, the same shape as
 * platforms/calendar/api/src/services/EVaultService.ts - not
 * PlatformEVaultService.ts (used by file-manager/esigner/ecurrency/etc.), which
 * provisions one eVault owned by the platform itself and is for a different
 * purpose. Here the platform token authenticates *this service*; the
 * X-ENAME header selects *whose* eVault a given write lands in.
 */
export class EVaultClient {
    private platformToken: string | null = null;
    private tokenExpiresAt = 0;
    private readonly registryUrl: string;
    private readonly evaultServerUri: string;
    private readonly publicUrl: string;
    private readonly fetchImpl: typeof fetch;

    constructor(options: EVaultClientOptions) {
        this.registryUrl = options.registryUrl;
        this.evaultServerUri = options.evaultServerUri;
        this.publicUrl = options.publicUrl;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }

    private async ensurePlatformToken(now = Date.now()): Promise<string> {
        if (this.platformToken && this.tokenExpiresAt > now + 5 * 60 * 1000) {
            return this.platformToken;
        }

        const res = await this.fetchImpl(
            new URL("/platforms/certification", this.registryUrl).toString(),
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ platform: this.publicUrl }),
            },
        );

        if (!res.ok) {
            throw new Error(`Failed to get platform token: HTTP ${res.status}`);
        }

        const data = (await res.json()) as PlatformTokenResponse;
        this.platformToken = data.token;
        this.tokenExpiresAt = data.expiresAt ?? now + 3_600_000;
        return this.platformToken;
    }

    private async getClient(eName: string): Promise<GraphQLClient> {
        const token = await this.ensurePlatformToken();
        return new GraphQLClient(`${this.evaultServerUri}/graphql`, {
            headers: {
                Authorization: `Bearer ${token}`,
                "X-ENAME": eName,
            },
            fetch: this.fetchImpl,
        });
    }

    /** Writes one commit as a MetaEnvelope into `eName`'s eVault. Returns the new envelope's id. */
    async writeCommit(
        eName: string,
        payload: CommitEnvelopePayload,
        acl: string[],
    ): Promise<string> {
        const client = await this.getClient(eName);
        const result = await client.request<{
            createMetaEnvelope: {
                metaEnvelope: { id: string } | null;
                errors: Array<{ message: string }> | null;
            };
        }>(CREATE_MUTATION, {
            input: {
                ontology: CODE_COMMIT_ONTOLOGY_ID,
                payload,
                acl,
            },
        });

        const { metaEnvelope, errors } = result.createMetaEnvelope;
        if (errors?.length) {
            throw new Error(errors.map((e) => e.message).join("; "));
        }
        if (!metaEnvelope) {
            throw new Error("createMetaEnvelope: no metaEnvelope returned");
        }
        return metaEnvelope.id;
    }
}
