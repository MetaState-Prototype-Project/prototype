export type BindingDocumentType =
    | "id_document"
    | "photograph"
    | "social_connection"
    | "self";

export interface BindingDocumentSignature {
    signer: string;
    signature: string;
    timestamp: string;
}

export interface BindingDocument {
    id: string;
    subject: string;
    type: BindingDocumentType;
    data: Record<string, unknown>;
    signatures: BindingDocumentSignature[];
}

export interface SocialConnection {
    id: string;
    name: string;
    witnessEName: string | null;
    signatures: BindingDocumentSignature[];
}

export interface WitnessSession {
    id: string;
    targetEName: string;
    expectedWitnessEName: string;
    status: "pending" | "witnessed" | "expired" | "rejected";
    signature?: string;
    witnessedBy?: string;
    createdAt: string;
    expiresAt: string;
}
