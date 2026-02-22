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

export interface BindingDocumentIdDocumentData {
    vendor: string;
    reference: string;
    name: string;
}

export interface BindingDocumentPhotographData {
    photoBlob: string;
}

export interface BindingDocumentSocialConnectionData {
    name: string;
}

export interface BindingDocumentSelfData {
    name: string;
}

export type BindingDocumentData =
    | BindingDocumentIdDocumentData
    | BindingDocumentPhotographData
    | BindingDocumentSocialConnectionData
    | BindingDocumentSelfData;

export interface BindingDocument {
    id: string;
    subject: string;
    type: BindingDocumentType;
    data: BindingDocumentData;
    signatures: BindingDocumentSignature[];
}
