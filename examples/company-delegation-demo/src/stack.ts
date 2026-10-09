import { randomUUID } from "node:crypto";

/** The local stack `pnpm dev:core` runs. */
export const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://localhost:4321";
export const PROVISIONER_URL =
    process.env.PROVISIONER_URL ?? "http://localhost:3001";
/** The provisioner's demo verification code. */
export const VERIFICATION_ID =
    process.env.DEMO_VERIFICATION_ID ?? "d66b7138-538a-465f-a6ce-f6985854c3f4";
export const PLATFORM_NAME = "company-delegation-demo";

async function json<T>(res: Response, what: string): Promise<T> {
    if (!res.ok)
        throw new Error(`${what} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
}

let token: Promise<string> | null = null;

/** A platform token from the Registry, for reading and writing eVaults. */
export function platformToken(): Promise<string> {
    token ??= fetch(new URL("/platforms/certification", REGISTRY_URL), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform: PLATFORM_NAME }),
    })
        .then((r) => json<{ token: string }>(r, "platform certification"))
        .then((r) => r.token);
    return token;
}

export async function resolveEVault(eName: string): Promise<string> {
    const url = new URL("/resolve", REGISTRY_URL);
    url.searchParams.set("w3id", eName);
    const body = await json<{ uri: string }>(
        await fetch(url),
        `resolve ${eName}`,
    );
    return body.uri;
}

/** A keyless eVault, the way group and company eVaults are made. */
export async function provisionKeylessEVault(): Promise<{
    eName: string;
    uri: string;
}> {
    const { token: registryEntropy } = await json<{ token: string }>(
        await fetch(new URL("/entropy", REGISTRY_URL)),
        "entropy",
    );
    const body = await json<{ w3id: string; uri: string }>(
        await fetch(new URL("/provision", PROVISIONER_URL), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                registryEntropy,
                namespace: randomUUID(),
                verificationId: VERIFICATION_ID,
            }),
        }),
        "provision company eVault",
    );
    return { eName: body.w3id, uri: body.uri };
}

async function graphql<T>(
    eName: string,
    query: string,
    variables: Record<string, unknown>,
): Promise<T> {
    const uri = await resolveEVault(eName);
    const body = await json<{ data?: T; errors?: { message: string }[] }>(
        await fetch(new URL("/graphql", uri), {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "X-ENAME": eName,
                authorization: `Bearer ${await platformToken()}`,
            },
            body: JSON.stringify({ query, variables }),
        }),
        "graphql",
    );
    if (body.errors?.length)
        throw new Error(body.errors.map((e) => e.message).join("; "));
    return body.data as T;
}

/**
 * Writes a record under an id the writer chose (the eVault creates it in
 * place), which is what lets a grant signature name the id beforehand.
 */
export async function writeRecord(
    eName: string,
    id: string,
    ontology: string,
    payload: Record<string, unknown>,
): Promise<void> {
    const data = await graphql<{
        updateMetaEnvelope: { errors: { message: string }[] | null };
    }>(
        eName,
        `mutation Write($id: ID!, $input: MetaEnvelopeInput!) {
            updateMetaEnvelope(id: $id, input: $input) { metaEnvelope { id } errors { message } }
        }`,
        { id, input: { ontology, payload, acl: ["*"] } },
    );
    const errors = data.updateMetaEnvelope.errors ?? [];
    if (errors.length) throw new Error(errors.map((e) => e.message).join("; "));
}

export async function readRecord(
    eName: string,
    id: string,
): Promise<Record<string, any> | null> {
    const data = await graphql<{
        metaEnvelope: { parsed: Record<string, any> } | null;
    }>(eName, `query Read($id: ID!) { metaEnvelope(id: $id) { parsed } }`, {
        id,
    });
    return data.metaEnvelope?.parsed ?? null;
}

/** A fresh record id, chosen before the record is signed and written. */
export const newRecordId = () => `@${randomUUID()}`;

/** A record's versions, oldest first, from the eVault's history API. */
export async function readHistory(
    eName: string,
    id: string,
): Promise<
    {
        version: number;
        operation: "create" | "update" | "delete";
        ontology: string;
        parsed: Record<string, any> | null;
        createdAt: string;
    }[]
> {
    const versions: any[] = [];
    let after: string | null = null;
    for (let page = 0; page < 20; page++) {
        const data: {
            metaEnvelopeHistory: {
                edges: { node: any }[];
                pageInfo: { hasNextPage: boolean; endCursor: string | null };
            } | null;
        } = await graphql(
            eName,
            `query History($id: ID!, $after: String) {
                metaEnvelopeHistory(id: $id, first: 100, after: $after) {
                    edges { node { version operation ontology parsed createdAt } }
                    pageInfo { hasNextPage endCursor }
                }
            }`,
            { id, after },
        );
        const conn = data.metaEnvelopeHistory;
        if (!conn) break;
        versions.push(...conn.edges.map((e) => e.node));
        if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
        after = conn.pageInfo.endCursor;
    }
    return versions.reverse();
}
