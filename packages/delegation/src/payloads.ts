import { canonicalJson, sha256Hex } from "./canonical";
import { isCoreScope, normaliseScope, type Scope } from "./scopes";

/**
 * Every payload this package defines starts with `w3ds-`. A login verifier
 * must reject any such string, so a signature made for a company or over a
 * grant can never be replayed as a login, and a login can never claim to be
 * on someone's behalf.
 */
export const RESERVED_PAYLOAD_PREFIX = "w3ds-";
export const SIGN_PAYLOAD_PREFIX = "w3ds-sign/v1\n";
export const GRANT_PAYLOAD_PREFIX = "w3ds-grant/v1\n";

/** The wallet's signable string is capped by verifiers (packages/auth). */
export const MAX_PAYLOAD_LENGTH = 1024;

export function isReservedPayload(payload: string): boolean {
    return payload.startsWith(RESERVED_PAYLOAD_PREFIX);
}

/**
 * What a delegate signs when signing for a company. The platform sends the
 * built string as the `w3ds://sign` session and the wallet signs it unchanged;
 * the platform then rejects it unless a live delegation covers it.
 */
export type DelegatedSignPayload = {
    /** The company the signature is made for. */
    onBehalfOf: string;
    /** The delegate whose key signs. */
    signer: string;
    scope: Scope;
    /** MetaEnvelope id of the Delegation relied on. */
    delegationId: string;
    /** Hash of the document or record being signed. */
    documentHash: string;
    /** The platform's signing session, so a signature answers one request. */
    session: string;
    issuedAt: string;
};

const SIGN_FIELDS: (keyof DelegatedSignPayload)[] = [
    "delegationId",
    "documentHash",
    "issuedAt",
    "onBehalfOf",
    "scope",
    "session",
    "signer",
];

export class PayloadError extends Error {}

export function buildDelegatedSignPayload(
    fields: DelegatedSignPayload,
): string {
    for (const key of SIGN_FIELDS) {
        if (typeof fields[key] !== "string" || fields[key].length === 0) {
            throw new PayloadError(`${key} is required`);
        }
    }
    const scope = normaliseScope(fields.scope);
    if (!scope) throw new PayloadError(`invalid scope ${fields.scope}`);
    if (isCoreScope(scope)) {
        throw new PayloadError(`${scope} can never be signed for a company`);
    }

    const body: DelegatedSignPayload = { ...fields, scope };
    const payload = SIGN_PAYLOAD_PREFIX + canonicalJson(pick(body));
    if (payload.length > MAX_PAYLOAD_LENGTH) {
        throw new PayloadError("payload exceeds the signable length");
    }
    return payload;
}

/**
 * Parses a signed string back into its fields. Only the exact canonical form
 * is accepted, so one set of fields has exactly one valid encoding.
 */
export function parseDelegatedSignPayload(
    payload: string,
): DelegatedSignPayload | null {
    if (!payload.startsWith(SIGN_PAYLOAD_PREFIX)) return null;
    let body: unknown;
    try {
        body = JSON.parse(payload.slice(SIGN_PAYLOAD_PREFIX.length));
    } catch {
        return null;
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;

    const keys = Object.keys(body).sort();
    if (keys.join() !== SIGN_FIELDS.join()) return null;
    const fields = body as DelegatedSignPayload;
    try {
        return buildDelegatedSignPayload(fields) === payload ? fields : null;
    } catch {
        return null;
    }
}

function pick(fields: DelegatedSignPayload): DelegatedSignPayload {
    const out = {} as DelegatedSignPayload;
    for (const key of SIGN_FIELDS) out[key] = fields[key];
    return out;
}

/** The signature a grantor puts on a Role, Delegation, Shareholding or Company. */
export type Authorization = {
    signerEName: string;
    signedPayload: string;
    signature: string;
    signedAt: string;
};

/**
 * The string a grantor signs to authorise a record. It names the record's
 * ontology, company, MetaEnvelope id, signer and signing time, and commits to
 * the record through its hash, which keeps it short whatever the record's size.
 *
 * Binding the id means a copy onto another record fails; binding the time lets
 * verifiers refuse an older signed state written back over a newer one. The
 * writer therefore picks the record's id before signing and creating it.
 */
export async function buildGrantPayload(input: {
    ontology: string;
    companyEName: string;
    recordId: string;
    signerEName: string;
    signedAt: string;
    record: Record<string, unknown>;
}): Promise<string> {
    const { authorization: _ignored, ...rest } = input.record;
    return (
        GRANT_PAYLOAD_PREFIX +
        canonicalJson({
            companyEName: input.companyEName,
            ontology: input.ontology,
            recordId: input.recordId,
            recordSha256: await sha256Hex(canonicalJson(rest)),
            signedAt: input.signedAt,
            signer: input.signerEName,
        })
    );
}

/** Checks a signature over a payload against the signer's bound keys. */
export type VerifySignature = (
    eName: string,
    payload: string,
    signature: string,
) => Promise<boolean>;

export type GrantProblem =
    | { code: "MISSING_AUTHORIZATION" }
    | { code: "BAD_SIGNED_AT" }
    | { code: "PAYLOAD_MISMATCH" }
    | { code: "BAD_SIGNATURE" };

/**
 * Checks that a record's `authorization` was signed by its stated signer over
 * this exact record under this id. Who that signer must be is the caller's
 * decision.
 */
export async function checkGrantAuthorization(
    ontology: string,
    companyEName: string,
    recordId: string,
    record: Record<string, unknown>,
    verify: VerifySignature,
): Promise<GrantProblem | null> {
    const auth = record.authorization as Partial<Authorization> | undefined;
    if (
        !auth ||
        typeof auth.signerEName !== "string" ||
        typeof auth.signedPayload !== "string" ||
        typeof auth.signature !== "string"
    ) {
        return { code: "MISSING_AUTHORIZATION" };
    }
    if (
        typeof auth.signedAt !== "string" ||
        Number.isNaN(Date.parse(auth.signedAt))
    ) {
        return { code: "BAD_SIGNED_AT" };
    }
    const expected = await buildGrantPayload({
        ontology,
        companyEName,
        recordId,
        signerEName: auth.signerEName,
        signedAt: auth.signedAt,
        record,
    });
    if (auth.signedPayload !== expected) return { code: "PAYLOAD_MISMATCH" };
    if (!(await verify(auth.signerEName, expected, auth.signature))) {
        return { code: "BAD_SIGNATURE" };
    }
    return null;
}
