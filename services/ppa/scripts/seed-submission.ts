/**
 * Dev-only fixture. Nothing in the repo writes `inSubmission` yet, so this
 * fabricates a reviewable submission end to end: an author eVault holding a
 * user profile, and a platform eVault holding a PlatformProfile that points at
 * that author and asks for access.
 *
 *   pnpm --filter ppa seed:submission
 *
 * Never run this against a real deployment — it provisions throwaway eVaults.
 */

import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import { config } from "dotenv";
import { GraphQLClient, gql } from "graphql-request";

// The package is ESM, so __dirname does not exist here.
const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../../.env") });

const registryUrl = process.env.PUBLIC_REGISTRY_URL || "http://localhost:4321";
const provisionerUrl =
    process.env.PUBLIC_PROVISIONER_URL || "http://localhost:3001";
const verificationId = process.env.DEMO_VERIFICATION_CODE || "";

const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

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

async function provision(): Promise<{ w3id: string; uri: string }> {
    const {
        data: { token: registryEntropy },
    } = await axios.get<{ token: string }>(
        new URL("/entropy", registryUrl).toString(),
        { timeout: 10_000 },
    );
    const { data } = await axios.post(
        new URL("/provision", provisionerUrl).toString(),
        {
            registryEntropy,
            namespace: randomUUID(),
            verificationId,
            publicKey: "0x0000000000000000000000000000000000000000",
        },
        { timeout: 30_000 },
    );
    if (!data?.w3id) {
        throw new Error(
            `Provisioner did not return a w3id: ${JSON.stringify(data)}`,
        );
    }
    return { w3id: data.w3id, uri: data.uri };
}

async function platformToken(): Promise<string> {
    const { data } = await axios.post<{ token: string }>(
        new URL("/platforms/certification", registryUrl).toString(),
        { platform: "ppa-seed" },
        { timeout: 10_000 },
    );
    return data.token;
}

async function write(
    evaultUri: string,
    ename: string,
    token: string,
    payload: Record<string, unknown>,
): Promise<string> {
    const client = new GraphQLClient(
        new URL("/graphql", evaultUri).toString(),
        {
            headers: { Authorization: `Bearer ${token}`, "X-ENAME": ename },
        },
    );
    const res = await client.request<{
        createMetaEnvelope: {
            metaEnvelope: { id: string } | null;
            errors: Array<{ field: string | null; message: string }> | null;
        };
    }>(CREATE_META_ENVELOPE, {
        input: { ontology: USER_ONTOLOGY, payload, acl: ["*"] },
    });
    const errors = res.createMetaEnvelope.errors ?? [];
    if (errors.length > 0) {
        throw new Error(errors.map((e) => e.message).join("; "));
    }
    const id = res.createMetaEnvelope.metaEnvelope?.id;
    if (!id) throw new Error("eVault returned no MetaEnvelope id");
    return id;
}

async function main(): Promise<void> {
    if (!verificationId) {
        throw new Error(
            "DEMO_VERIFICATION_CODE is required to provision eVaults locally",
        );
    }

    const now = new Date().toISOString();
    const token = await platformToken();

    console.log("[seed] provisioning an author eVault");
    const author = await provision();
    await write(author.uri, author.w3id, token, {
        displayName: "Robin Fairweather",
        username: "robin",
        bio: "Building a tide-tracking platform for coastal communities.",
        avatarUrl: "",
        ename: author.w3id,
        createdAt: now,
        updatedAt: now,
    });
    console.log(`[seed] author: ${author.w3id}`);

    console.log("[seed] provisioning a platform eVault");
    const platform = await provision();
    const slug = `tidewatch-${platform.w3id.slice(1, 7)}`;
    await write(platform.uri, platform.w3id, token, {
        platformName: slug,
        displayName: "Tidewatch",
        description:
            "Community tide and flood reporting. Applying for network access so members can carry their reports between platforms.",
        version: "0.3.1",
        ename: platform.w3id,
        isActive: true,
        isArchived: false,
        inSubmission: true,
        authorEnames: [author.w3id],
        createdAt: now,
        updatedAt: now,
        url: "https://tidewatch.example",
        logoUrl: "",
        category: "Wellness",
    });

    console.log("\nSEEDED SUBMISSION");
    console.log("-------------------------------------------------");
    console.log(`platform eName: ${platform.w3id}`);
    console.log(`platform slug:  ${slug}`);
    console.log(`author eName:   ${author.w3id}`);
    console.log(
        "\nAaaS ingests on a short delay — give it a moment, then reload the PPA submissions list.",
    );
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
