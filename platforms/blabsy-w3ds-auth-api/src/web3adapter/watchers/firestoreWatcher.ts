import {
    DocumentData,
    DocumentSnapshot,
    QuerySnapshot,
} from "firebase-admin/firestore";
import { DataTransformer } from "../types";
import { EVaultClient } from "../graphql/evaultClient";
import { IDMappingStore } from "../types";

export class FirestoreWatcher<T extends DocumentData> {
    private unsubscribe: (() => void) | null = null;

    constructor(
        private readonly collection: FirebaseFirestore.CollectionReference,
        private readonly entityType: string,
        private readonly transformer: DataTransformer<T>,
        private readonly graphqlClient: EVaultClient,
        private readonly idMappingStore: IDMappingStore
    ) {}

    async start(): Promise<void> {
        // First, get all existing documents
        const snapshot = await this.collection.get();
        await this.processSnapshot(snapshot);

        // Then set up real-time listener
        this.unsubscribe = this.collection.onSnapshot(
            async (snapshot) => {
                try {
                    await this.processSnapshot(snapshot);
                } catch (error) {
                    console.error("Error processing snapshot:", error);
                }
            },
            (error) => {
                console.error("Error in Firestore listener:", error);
            }
        );
    }

    async stop(): Promise<void> {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    private async processSnapshot(snapshot: QuerySnapshot): Promise<void> {
        const changes = snapshot.docChanges();

        for (const change of changes) {
            const doc = change.doc;
            const data = doc.data() as T;

            try {
                switch (change.type) {
                    case "added":
                    case "modified":
                        await this.handleCreateOrUpdate(doc.id, data);
                        break;
                }
            } catch (error) {
                console.error(
                    `Error processing ${change.type} for document ${doc.id}:`,
                    error
                );
            }
        }
    }

    private async handleCreateOrUpdate(docId: string, data: T): Promise<void> {
        try {
            // Check if this resource is already mapped
            const existingMetaEnvelopeId =
                await this.idMappingStore.getMetaEnvelopeId(
                    docId,
                    this.entityType
                );

            // Transform to global format
            const envelope = await this.transformer.toGlobal(data);

            let metaEnvelopeId: string;
            if (existingMetaEnvelopeId) {
                console.log(
                    `Updating existing resource ${docId} mapped to metaEnvelope ${existingMetaEnvelopeId}`
                );
                // Update existing metaEnvelope
                const result = await this.graphqlClient.updateMetaEnvelopeById(
                    existingMetaEnvelopeId,
                    envelope
                );
                metaEnvelopeId = result.metaEnvelope.id;
            } else {
                // Store new metaEnvelope
                metaEnvelopeId = await this.graphqlClient.storeMetaEnvelope(
                    envelope
                );

                // Store ID mapping
                await this.idMappingStore.store(
                    docId,
                    metaEnvelopeId,
                    this.entityType
                );
            }

            // Handle references if needed
            if (envelope.acl && envelope.acl.length > 0) {
                for (const w3id of envelope.acl) {
                    await this.graphqlClient.storeReference(
                        metaEnvelopeId,
                        w3id
                    );
                }
            }

            console.log(`MetaEnvelope ID: ${metaEnvelopeId}`);
        } catch (error) {
            console.error(
                `Error handling create/update for ${this.entityType}:`,
                error
            );
            throw error;
        }
    }
}
