export type BindingDocumentType =
    | "id_document"
    | "photograph"
    | "social_connection"
    | "self"
    | "personal_parameters"
    | "security_question";

export interface BindingDocumentSignature {
    signer: string;
    signature: string;
    timestamp: string;
}

export interface BindingDocumentIdDocumentData {
    vendor: string;
    reference: string;
    name: string;
}

export interface BindingDocumentPhotographData {
    photoBlob: string;
    /** Free-text caption supplied by the user when adding the photo mark.
     *  Optional so docs created before this field was introduced still parse. */
    description?: string;
}

export interface BindingDocumentSocialConnectionData {
    kind: "social_connection";
    name: string;
    parties: [string, string];
    relation_description: string;
}

export interface BindingDocumentSelfData {
    kind: "self";
    name: string;
}

/** Biographical free-text card on the Personal flow ("date and place of birth,
 *  height, eye color, etc."). Single field — the whole entry is a paragraph the
 *  user writes themselves. */
export interface BindingDocumentPersonalParametersData {
    kind: "personal_parameters";
    text: string;
}

/** User-authored security question used for account recovery. The question is
 *  stored as plaintext; the answer is normalised + Argon2id-hashed before it
 *  ever reaches this service (or, alternatively, hashed by callers via the
 *  shared util). Either way, only the resulting hash is persisted. */
export interface BindingDocumentSecurityQuestionData {
    kind: "security_question";
    question: string;
    /** Argon2id hash of the normalised answer. Never the raw answer. */
    answerHash: string;
}

export type BindingDocumentData =
    | BindingDocumentIdDocumentData
    | BindingDocumentPhotographData
    | BindingDocumentSocialConnectionData
    | BindingDocumentSelfData
    | BindingDocumentPersonalParametersData
    | BindingDocumentSecurityQuestionData;

export interface BindingDocument {
    subject: string;
    type: BindingDocumentType;
    data: BindingDocumentData;
    signatures: BindingDocumentSignature[];
}
