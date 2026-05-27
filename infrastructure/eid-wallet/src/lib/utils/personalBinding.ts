/**
 * Personal-flow binding-doc helpers (photograph + personal_parameters +
 * security_question). Standalone like socialBinding.ts so they can be called
 * from any page/sheet given the caller's eName + vault URL.
 *
 * Convention: each function returns the new metaEnvelopeId on create. The
 * caller is responsible for signing the canonical payload — these helpers
 * just package the mutation.
 */

import {
    type BindingDocEdge,
    type CreateBindingDocResult,
    vaultGqlRequest,
} from "./socialBinding";

/**
 * Shared cap on free-text fields the user writes into the personal-binding
 * sheets (parameters textarea, knowledge question/answer, photo description).
 * Anything past this is almost certainly user error and stresses the
 * canonical-hash signing path. Enforced via `maxlength` in each input.
 */
export const PERSONAL_BINDING_MAX_LENGTH = 2048;

const CREATE_BINDING_DOC_MUTATION = `
    mutation CreateBindingDoc($input: CreateBindingDocumentInput!) {
        createBindingDocument(input: $input) {
            metaEnvelopeId
            errors { message code }
        }
    }
`;

const DELETE_META_ENVELOPE_MUTATION = `
    mutation DeleteMetaEnvelope($id: String!) {
        deleteMetaEnvelope(id: $id)
    }
`;

const HASH_SECURITY_ANSWER_MUTATION = `
    mutation HashSecurityAnswer($answer: String!) {
        hashSecurityAnswer(answer: $answer) {
            hash
            errors { message code }
        }
    }
`;

const VALIDATE_SECURITY_ANSWER_MUTATION = `
    mutation ValidateSecurityAnswer($input: ValidateSecurityAnswerInput!) {
        validateSecurityAnswer(input: $input) {
            success
            reason
            lockedUntil
            attemptsRemaining
            errors { message code }
        }
    }
`;

// Three typed queries instead of one bag-of-everything so we don't pull
// id_document / self / social_connection over the wire and we don't hit the
// 200-doc ceiling once users accumulate many photos.
export const PERSONAL_BINDING_BY_TYPE_QUERY = `
    query LoadPersonalByType($type: BindingDocumentType!) {
        bindingDocuments(type: $type, first: 100) {
            edges {
                node {
                    id
                    parsed
                }
            }
        }
    }
`;

interface OwnerSignature {
    signer: string;
    signature: string;
    timestamp: string;
}

function normalizeEname(ename: string): string {
    return ename.startsWith("@") ? ename : `@${ename}`;
}

function unwrapCreate(result: CreateBindingDocResult): string {
    if (result.createBindingDocument.errors?.length) {
        throw new Error(
            result.createBindingDocument.errors
                .map((e) => e.message)
                .join("; "),
        );
    }
    const id = result.createBindingDocument.metaEnvelopeId;
    if (!id)
        throw new Error("createBindingDocument returned no metaEnvelopeId");
    return id;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createPhotographMark(
    gqlUrl: string,
    ownerEname: string,
    ownerSignature: OwnerSignature,
    photoBlob: string,
    description?: string,
): Promise<string> {
    const subject = normalizeEname(ownerEname);
    const data: { photoBlob: string; description?: string } = { photoBlob };
    if (description?.trim()) data.description = description;

    const result = await vaultGqlRequest<CreateBindingDocResult>(
        gqlUrl,
        ownerEname,
        CREATE_BINDING_DOC_MUTATION,
        {
            input: {
                subject,
                type: "photograph",
                data,
                ownerSignature,
            },
        },
    );
    return unwrapCreate(result);
}

export async function createPersonalParameters(
    gqlUrl: string,
    ownerEname: string,
    ownerSignature: OwnerSignature,
    text: string,
): Promise<string> {
    const subject = normalizeEname(ownerEname);
    const result = await vaultGqlRequest<CreateBindingDocResult>(
        gqlUrl,
        ownerEname,
        CREATE_BINDING_DOC_MUTATION,
        {
            input: {
                subject,
                type: "personal_parameters",
                data: { kind: "personal_parameters", text },
                ownerSignature,
            },
        },
    );
    return unwrapCreate(result);
}

export async function createSecurityQuestion(
    gqlUrl: string,
    ownerEname: string,
    ownerSignature: OwnerSignature,
    question: string,
    answerHash: string,
): Promise<string> {
    const subject = normalizeEname(ownerEname);
    const result = await vaultGqlRequest<CreateBindingDocResult>(
        gqlUrl,
        ownerEname,
        CREATE_BINDING_DOC_MUTATION,
        {
            input: {
                subject,
                type: "security_question",
                data: { kind: "security_question", question, answerHash },
                ownerSignature,
            },
        },
    );
    return unwrapCreate(result);
}

// ---------------------------------------------------------------------------
// Hash / validate
// ---------------------------------------------------------------------------

interface HashSecurityAnswerResult {
    hashSecurityAnswer: {
        hash: string | null;
        errors: Array<{ message: string; code?: string }>;
    };
}

/** Ask the BE to normalise + Argon2id-hash a raw answer. */
export async function hashSecurityAnswerRemote(
    gqlUrl: string,
    callerEname: string,
    rawAnswer: string,
): Promise<string> {
    const result = await vaultGqlRequest<HashSecurityAnswerResult>(
        gqlUrl,
        callerEname,
        HASH_SECURITY_ANSWER_MUTATION,
        { answer: rawAnswer },
    );
    if (result.hashSecurityAnswer.errors?.length) {
        throw new Error(
            result.hashSecurityAnswer.errors.map((e) => e.message).join("; "),
        );
    }
    if (!result.hashSecurityAnswer.hash) {
        throw new Error("hashSecurityAnswer returned no hash");
    }
    return result.hashSecurityAnswer.hash;
}

export interface ValidateSecurityAnswerResult {
    success: boolean;
    reason: "locked" | "mismatch" | "not_found" | "invalid_doc" | null;
    lockedUntil: string | null;
    attemptsRemaining: number | null;
}

export async function validateSecurityAnswerRemote(
    gqlUrl: string,
    callerEname: string,
    metaEnvelopeId: string,
    candidate: string,
): Promise<ValidateSecurityAnswerResult> {
    const result = await vaultGqlRequest<{
        validateSecurityAnswer: ValidateSecurityAnswerResult & {
            errors: Array<{ message: string; code?: string }>;
        };
    }>(gqlUrl, callerEname, VALIDATE_SECURITY_ANSWER_MUTATION, {
        input: { metaEnvelopeId, candidate },
    });
    if (result.validateSecurityAnswer.errors?.length) {
        throw new Error(
            result.validateSecurityAnswer.errors
                .map((e) => e.message)
                .join("; "),
        );
    }
    return {
        success: result.validateSecurityAnswer.success,
        reason: result.validateSecurityAnswer.reason,
        lockedUntil: result.validateSecurityAnswer.lockedUntil,
        attemptsRemaining: result.validateSecurityAnswer.attemptsRemaining,
    };
}

// ---------------------------------------------------------------------------
// Delete + load
// ---------------------------------------------------------------------------

export async function deletePersonalBinding(
    gqlUrl: string,
    ownerEname: string,
    metaEnvelopeId: string,
): Promise<void> {
    await vaultGqlRequest(gqlUrl, ownerEname, DELETE_META_ENVELOPE_MUTATION, {
        id: metaEnvelopeId,
    });
}

export interface LoadedPhotograph {
    metaEnvelopeId: string;
    photoBlob: string;
    description: string;
}

export interface LoadedPersonalParameters {
    metaEnvelopeId: string;
    text: string;
}

export interface LoadedSecurityQuestion {
    metaEnvelopeId: string;
    question: string;
}

export interface LoadedPersonalBindings {
    photographs: LoadedPhotograph[];
    parameters: LoadedPersonalParameters | null;
    securityQuestion: LoadedSecurityQuestion | null;
}

/** Pick the edge whose owner signature is most recent. */
function pickLatestEdge(edges: BindingDocEdge[]): BindingDocEdge | null {
    let best: BindingDocEdge | null = null;
    let bestTs = "";
    for (const edge of edges) {
        const ts = edge.node.parsed?.signatures?.[0]?.timestamp ?? "";
        if (ts > bestTs) {
            bestTs = ts;
            best = edge;
        }
    }
    return best;
}

/**
 * Pull personal-flow binding docs from the caller's vault, one typed query
 * per kind, in parallel. Single-instance types (parameters, security_question)
 * are deduplicated by picking the latest signature timestamp so stale docs
 * from a failed-delete edit don't surface the old value.
 */
export async function loadPersonalBindings(
    gqlUrl: string,
    ownerEname: string,
): Promise<LoadedPersonalBindings> {
    type Resp = { bindingDocuments: { edges: BindingDocEdge[] } };
    const [photosResp, paramsResp, securityResp] = await Promise.all([
        vaultGqlRequest<Resp>(
            gqlUrl,
            ownerEname,
            PERSONAL_BINDING_BY_TYPE_QUERY,
            { type: "photograph" },
        ),
        vaultGqlRequest<Resp>(
            gqlUrl,
            ownerEname,
            PERSONAL_BINDING_BY_TYPE_QUERY,
            { type: "personal_parameters" },
        ),
        vaultGqlRequest<Resp>(
            gqlUrl,
            ownerEname,
            PERSONAL_BINDING_BY_TYPE_QUERY,
            { type: "security_question" },
        ),
    ]);

    const photographs: LoadedPhotograph[] = [];
    for (const edge of photosResp.bindingDocuments?.edges ?? []) {
        const parsed = edge.node.parsed;
        if (parsed?.type !== "photograph") continue;
        const d = parsed.data as Record<string, unknown>;
        if (typeof d.photoBlob !== "string") continue;
        photographs.push({
            metaEnvelopeId: edge.node.id,
            photoBlob: d.photoBlob,
            description: typeof d.description === "string" ? d.description : "",
        });
    }

    const paramsEdge = pickLatestEdge(paramsResp.bindingDocuments?.edges ?? []);
    const paramsData = paramsEdge?.node.parsed?.data as
        | Record<string, unknown>
        | undefined;
    const parameters: LoadedPersonalParameters | null =
        paramsEdge && typeof paramsData?.text === "string"
            ? {
                  metaEnvelopeId: paramsEdge.node.id,
                  text: paramsData.text,
              }
            : null;

    const securityEdge = pickLatestEdge(
        securityResp.bindingDocuments?.edges ?? [],
    );
    const securityData = securityEdge?.node.parsed?.data as
        | Record<string, unknown>
        | undefined;
    const securityQuestion: LoadedSecurityQuestion | null =
        securityEdge && typeof securityData?.question === "string"
            ? {
                  metaEnvelopeId: securityEdge.node.id,
                  question: securityData.question,
              }
            : null;

    return { photographs, parameters, securityQuestion };
}
