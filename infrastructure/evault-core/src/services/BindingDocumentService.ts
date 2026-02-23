import axios from "axios";
import nacl from "tweetnacl";
import type { DbService } from "../core/db/db.service";
import type { FindMetaEnvelopesPaginatedOptions, MetaEnvelopeConnection } from "../core/db/types";
import {
    computeBindingDocumentHash,
    getCanonicalBindingDocumentBytes,
} from "../core/utils/binding-document-hash";
import type {
    BindingDocument,
    BindingDocumentData,
    BindingDocumentIdDocumentData,
    BindingDocumentPhotographData,
    BindingDocumentSelfData,
    BindingDocumentSignature,
    BindingDocumentSocialConnectionData,
    BindingDocumentType,
} from "../core/types/binding-document";

export const BINDING_DOCUMENT_ONTOLOGY = "b1d0a8c3-4e5f-6789-0abc-def012345678";

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

function validateBindingDocumentData(
    type: BindingDocumentType,
    data: unknown,
): BindingDocumentData {
    if (typeof data !== "object" || data === null) {
        throw new ValidationError("Binding document data must be an object");
    }
    const d = data as Record<string, unknown>;
    switch (type) {
        case "id_document": {
            if (
                typeof d.vendor !== "string" ||
                typeof d.reference !== "string" ||
                typeof d.name !== "string"
            ) {
                throw new ValidationError(
                    'id_document data must have string fields: vendor, reference, name',
                );
            }
            return { vendor: d.vendor, reference: d.reference, name: d.name } as BindingDocumentIdDocumentData;
        }
        case "photograph": {
            if (typeof d.photoBlob !== "string") {
                throw new ValidationError(
                    'photograph data must have string field: photoBlob',
                );
            }
            return { photoBlob: d.photoBlob } as BindingDocumentPhotographData;
        }
        case "social_connection": {
            if (typeof d.name !== "string") {
                throw new ValidationError(
                    'social_connection data must have string field: name',
                );
            }
            return { kind: "social_connection", name: d.name } as BindingDocumentSocialConnectionData;
        }
        case "self": {
            if (typeof d.name !== "string") {
                throw new ValidationError(
                    'self data must have string field: name',
                );
            }
            return { kind: "self", name: d.name } as BindingDocumentSelfData;
        }
        default: {
            const _exhaustive: never = type;
            throw new ValidationError(`Unknown binding document type: ${_exhaustive}`);
        }
    }
}

export interface CreateBindingDocumentInput {
    subject: string;
    type: BindingDocumentType;
    data: BindingDocumentData;
    ownerSignature: BindingDocumentSignature;
}

export interface AddCounterpartySignatureInput {
    metaEnvelopeId: string;
    signature: BindingDocumentSignature;
}

export class BindingDocumentService {
    constructor(private db: DbService) {}

    private normalizeSubject(subject: string): string {
        return subject.startsWith("@") ? subject : `@${subject}`;
    }

    private base64urlToUint8Array(base64url: string): Uint8Array {
        const padded = base64url
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(Math.ceil(base64url.length / 4) * 4, "=");
        return Uint8Array.from(Buffer.from(padded, "base64"));
    }

    private parseProvisionerSigner(signer: string): { jwksUrl: string; kid: string } | null {
        try {
            const url = new URL(signer);
            if (!url.pathname.endsWith("/.well-known/jwks.json")) return null;
            const kid = url.hash.replace(/^#/, "");
            if (!kid) return null;
            return {
                jwksUrl: `${url.origin}${url.pathname}`,
                kid,
            };
        } catch {
            return null;
        }
    }

    private async verifyProvisionerSignature(
        signer: string,
        signature: string,
        doc: {
            subject: string;
            type: BindingDocumentType;
            data: BindingDocumentData;
        },
    ): Promise<boolean> {
        const signerInfo = this.parseProvisionerSigner(signer);
        if (!signerInfo) return false;
        try {
            const { data: jwks } = await axios.get(signerInfo.jwksUrl, {
                timeout: 5000,
            });
            const key = (jwks?.keys ?? []).find(
                (k: { kid?: string; kty?: string; crv?: string; x?: string }) =>
                    k.kid === signerInfo.kid,
            );
            if (!key || key.kty !== "OKP" || key.crv !== "Ed25519" || !key.x) {
                return false;
            }
            const publicKey = this.base64urlToUint8Array(key.x);
            const signatureBytes = this.base64urlToUint8Array(signature);
            const canonicalBytes = getCanonicalBindingDocumentBytes(doc);
            return nacl.sign.detached.verify(
                canonicalBytes,
                signatureBytes,
                publicKey,
            );
        } catch {
            return false;
        }
    }

    async createBindingDocument(
        input: CreateBindingDocumentInput,
        eName: string,
    ): Promise<{ id: string; bindingDocument: BindingDocument }> {
        const normalizedSubject = this.normalizeSubject(input.subject);

        const validatedData = validateBindingDocumentData(input.type, input.data);

        const docToVerify = {
            subject: normalizedSubject,
            type: input.type,
            data: validatedData,
        };
        const expectedHash = computeBindingDocumentHash(docToVerify);
        const hasLegacyHashSignature = input.ownerSignature.signature === expectedHash;
        const hasValidProvisionerSignature =
            await this.verifyProvisionerSignature(
                input.ownerSignature.signer,
                input.ownerSignature.signature,
                docToVerify,
            );
        if (!hasLegacyHashSignature && !hasValidProvisionerSignature) {
            throw new ValidationError("Invalid owner signature");
        }

        const bindingDocument: BindingDocument = {
            subject: normalizedSubject,
            type: input.type,
            data: validatedData,
            signatures: [input.ownerSignature],
        };

        const result = await this.db.storeMetaEnvelope(
            {
                ontology: BINDING_DOCUMENT_ONTOLOGY,
                payload: bindingDocument,
                acl: [normalizedSubject],
            },
            [normalizedSubject],
            eName,
        );

        return {
            id: result.metaEnvelope.id,
            bindingDocument,
        };
    }

    async addCounterpartySignature(
        input: AddCounterpartySignatureInput,
        eName: string,
    ): Promise<BindingDocument> {
        const metaEnvelope = await this.db.findMetaEnvelopeById(
            input.metaEnvelopeId,
            eName,
        );

        if (!metaEnvelope) {
            throw new Error("Binding document not found");
        }

        if (metaEnvelope.ontology !== BINDING_DOCUMENT_ONTOLOGY) {
            throw new Error("Not a binding document");
        }

        const bindingDocument = metaEnvelope.parsed as BindingDocument;

        // Counterparty signatures still use deterministic hash form.
        const expectedHash = computeBindingDocumentHash({
            subject: bindingDocument.subject,
            type: bindingDocument.type,
            data: bindingDocument.data,
        });
        if (input.signature.signature !== expectedHash) {
            throw new ValidationError(
                `Invalid counterparty signature: expected SHA-256 hash of canonical binding document`,
            );
        }

        // For social_connection documents the counterparty must be the subject
        if (bindingDocument.type === "social_connection") {
            if (input.signature.signer !== bindingDocument.subject) {
                throw new Error(
                    `Signer "${input.signature.signer}" is not the expected counterparty "${bindingDocument.subject}"`,
                );
            }
        }

        // Prevent duplicate signatures from the same signer
        const alreadySigned = bindingDocument.signatures.some(
            (sig) => sig.signer === input.signature.signer,
        );
        if (alreadySigned) {
            throw new Error(
                `Signer "${input.signature.signer}" has already signed this binding document`,
            );
        }

        const updatedBindingDocument: BindingDocument = {
            ...bindingDocument,
            signatures: [...bindingDocument.signatures, input.signature],
        };

        await this.db.updateMetaEnvelopeById(
            input.metaEnvelopeId,
            {
                ontology: BINDING_DOCUMENT_ONTOLOGY,
                payload: updatedBindingDocument,
                acl: [bindingDocument.subject],
            },
            [bindingDocument.subject],
            eName,
        );

        return updatedBindingDocument;
    }

    async getBindingDocument(
        metaEnvelopeId: string,
        eName: string,
    ): Promise<BindingDocument | null> {
        const metaEnvelope = await this.db.findMetaEnvelopeById(
            metaEnvelopeId,
            eName,
        );

        if (!metaEnvelope) {
            return null;
        }

        if (metaEnvelope.ontology !== BINDING_DOCUMENT_ONTOLOGY) {
            return null;
        }

        return metaEnvelope.parsed as BindingDocument;
    }

    async findBindingDocuments(
        eName: string,
        options: {
            type?: BindingDocumentType;
            first?: number;
            after?: string;
            last?: number;
            before?: string;
        } = {},
    ): Promise<MetaEnvelopeConnection<BindingDocument>> {
        const { type, first, after, last, before } = options;

        const result =
            await this.db.findMetaEnvelopesPaginated<BindingDocument>(eName, {
                filter: {
                    ontologyId: BINDING_DOCUMENT_ONTOLOGY,
                    ...(type
                        ? {
                              search: {
                                  term: type,
                                  fields: ["type"],
                                  mode: "EXACT",
                                  caseSensitive: true,
                              },
                          }
                        : {}),
                },
                first,
                after,
                last,
                before,
            });

        return result as MetaEnvelopeConnection<BindingDocument>;
    }
}
