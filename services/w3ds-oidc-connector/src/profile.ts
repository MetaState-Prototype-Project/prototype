/**
 * Reads the profile a user keeps in their own eVault, so IdPs get a real
 * email address and name instead of values derived from the eName.
 *
 * Everything here is best effort. The profile is self-asserted, so it never
 * decides who the user is, and an unreachable Registry or eVault must not
 * stop a login: any failure yields an empty profile.
 */

import { log } from "./log.js";

/** The W3DS `User` ontology. */
export const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";
/** The W3DS `ProfessionalProfile` ontology. */
export const PROFESSIONAL_PROFILE_ONTOLOGY =
    "550e8400-e29b-41d4-a716-446655440009";

export interface Profile {
    email?: string;
    name?: string;
    givenName?: string;
    familyName?: string;
}

export type ProfileReader = (eName: string) => Promise<Profile>;

const PROFILE_QUERY = `
    query Profile($user: ID!, $professional: ID!) {
        user: metaEnvelopes(filter: { ontologyId: $user }, first: 20) {
            edges { node { id parsed } }
        }
        professional: metaEnvelopes(filter: { ontologyId: $professional }, first: 20) {
            edges { node { id parsed } }
        }
    }
`;

const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 256;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Parsed = Record<string, unknown>;
type Connection = { edges?: { node?: { parsed?: unknown } | null }[] } | null;

function text(value: unknown, max: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed && trimmed.length <= max ? trimmed : undefined;
}

function email(parsed: Parsed | undefined): string | undefined {
    const value = text(parsed?.email, MAX_EMAIL_LENGTH);
    return value && EMAIL.test(value) ? value : undefined;
}

/**
 * An eVault can hold several envelopes of one ontology (legacy replicas next
 * to the primary). The primary is the one whose `ename` names the owner.
 */
function primary(connection: Connection, eName: string): Parsed | undefined {
    const parsed = (connection?.edges ?? [])
        .map((edge) => edge?.node?.parsed)
        .filter(
            (value): value is Parsed =>
                typeof value === "object" && value !== null,
        );
    return parsed.find((value) => value.ename === eName) ?? parsed[0];
}

/**
 * Profiles are written by many platforms and disagree on name fields. A
 * `displayName` equal to the eName is a placeholder, not a name.
 */
function names(parsed: Parsed | undefined, eName: string): Omit<Profile, "email"> {
    if (!parsed) return {};
    const givenName =
        text(parsed.givenName, MAX_NAME_LENGTH) ??
        text(parsed.firstName, MAX_NAME_LENGTH);
    const familyName =
        text(parsed.familyName, MAX_NAME_LENGTH) ??
        text(parsed.lastName, MAX_NAME_LENGTH);
    const displayName = text(parsed.displayName, MAX_NAME_LENGTH);
    const joined = [givenName, familyName].filter(Boolean).join(" ");
    const name =
        displayName && displayName !== eName ? displayName : joined || undefined;
    return {
        ...(name && { name }),
        ...(givenName && { givenName }),
        ...(familyName && { familyName }),
    };
}

/** The profile carried by the envelopes of one eVault. */
export function profileFromEnvelopes(
    eName: string,
    data: { user?: Connection; professional?: Connection },
): Profile {
    const user = primary(data.user ?? null, eName);
    const professional = primary(data.professional ?? null, eName);
    const fromUser = names(user, eName);
    const address = email(user) ?? email(professional);
    return {
        ...(address && { email: address }),
        ...(fromUser.name ? fromUser : names(professional, eName)),
    };
}

export function createProfileReader(options: {
    registryUrl: string;
    platformName: string;
    timeoutMs: number;
    fetch?: typeof fetch;
}): ProfileReader {
    const fetchImpl = options.fetch ?? fetch;
    let token: Promise<string> | undefined;

    // The Registry issues these to any platform name and they live for a
    // year, so one is reused until an eVault refuses it.
    const platformToken = (signal: AbortSignal): Promise<string> => {
        if (token) return token;
        const pending = (async () => {
            const res = await fetchImpl(
                new URL("/platforms/certification", options.registryUrl),
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ platform: options.platformName }),
                    signal,
                },
            );
            if (!res.ok) throw new Error(`certification returned ${res.status}`);
            const body = (await res.json()) as { token?: unknown };
            if (typeof body.token !== "string" || !body.token) {
                throw new Error("certification returned no token");
            }
            return body.token;
        })();
        // Never keep a failure: the next login asks again.
        pending.catch(() => {
            if (token === pending) token = undefined;
        });
        token = pending;
        return pending;
    };

    const resolve = async (eName: string, signal: AbortSignal) => {
        const url = new URL("/resolve", options.registryUrl);
        url.searchParams.set("w3id", eName);
        const res = await fetchImpl(url, { signal });
        if (!res.ok) throw new Error(`resolve returned ${res.status}`);
        const body = (await res.json()) as { uri?: unknown; evaultUrl?: unknown };
        const vault = body.uri ?? body.evaultUrl;
        if (typeof vault !== "string" || !vault) {
            throw new Error("resolve returned no eVault");
        }
        return vault;
    };

    const query = async (
        vault: string,
        eName: string,
        signal: AbortSignal,
        retry: boolean,
    ): Promise<Profile> => {
        const bearer = await platformToken(signal);
        const res = await fetchImpl(new URL("/graphql", vault), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${bearer}`,
                "X-ENAME": eName,
            },
            body: JSON.stringify({
                query: PROFILE_QUERY,
                variables: {
                    user: USER_ONTOLOGY,
                    professional: PROFESSIONAL_PROFILE_ONTOLOGY,
                },
            }),
            signal,
        });
        if ((res.status === 401 || res.status === 403) && retry) {
            token = undefined;
            return query(vault, eName, signal, false);
        }
        if (!res.ok) throw new Error(`eVault returned ${res.status}`);
        // One ontology failing still leaves the other's data usable.
        const body = (await res.json()) as {
            data?: { user?: Connection; professional?: Connection } | null;
        };
        return profileFromEnvelopes(eName, body.data ?? {});
    };

    return async (eName) => {
        const signal = AbortSignal.timeout(options.timeoutMs);
        try {
            const vault = await resolve(eName, signal);
            return await query(vault, eName, signal, true);
        } catch (error) {
            log.info(
                `could not read the profile of ${eName}:`,
                error instanceof Error ? error.message : error,
            );
            return {};
        }
    };
}
