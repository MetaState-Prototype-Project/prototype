import { W3IDBuilder } from "w3id";
import type { DbService } from "../core/db/db.service";
import type { FindMetaEnvelopesPaginatedOptions } from "../core/db/types";
import type { MetaEnvelopeConnection } from "../core/db/types";
import type {
    BindingDocument,
    BindingDocumentData,
    BindingDocumentSignature,
    BindingDocumentType,
} from "../core/types/binding-document";

const BINDING_DOCUMENT_ONTOLOGY = "b1d0a8c3-4e5f-6789-0abc-def012345678";

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

    async createBindingDocument(
        input: CreateBindingDocumentInput,
        eName: string,
    ): Promise<{ id: string; bindingDocument: BindingDocument }> {
        const w3id = await new W3IDBuilder().build();
        const normalizedSubject = this.normalizeSubject(input.subject);

        const bindingDocument: BindingDocument = {
            id: w3id.id,
            subject: normalizedSubject,
            type: input.type,
            data: input.data,
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
                },
                first,
                after,
                last,
                before,
            });

        if (!type) {
            return result as MetaEnvelopeConnection<BindingDocument>;
        }

        const filteredEdges = result.edges.filter((edge) => {
            return edge.node.parsed?.type === type;
        });

        return {
            ...result,
            edges: filteredEdges,
            totalCount: filteredEdges.length,
        };
    }
}
