import {
    DocumentChange,
    DocumentData,
    QuerySnapshot,
    CollectionReference,
    CollectionGroup,
} from "firebase-admin/firestore";
import path from "path";
import dotenv from "dotenv";
import { adapter } from "../../controllers/WebhookController";
dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

export class FirestoreWatcher {
    private unsubscribe: (() => void) | null = null;
    private adapter = adapter;
    private isProcessing = false;
    private retryCount = 0;
    private readonly maxRetries: number = 3;
    private readonly retryDelay: number = 1000; // 1 second

    constructor(
        private readonly collection:
            | CollectionReference<DocumentData>
            | CollectionGroup<DocumentData>
    ) {}

    async start(): Promise<void> {
        const collectionPath =
            this.collection instanceof CollectionReference
                ? this.collection.path
                : "collection group";

        try {
            // First, get all existing documents
            const snapshot = await this.collection.get();
            await this.processSnapshot(snapshot);

            // Then set up real-time listener
            this.unsubscribe = this.collection.onSnapshot(
                async (snapshot) => {
                    if (this.isProcessing) {
                        console.log(
                            "Still processing previous snapshot, skipping..."
                        );
                        return;
                    }

                    try {
                        this.isProcessing = true;
                        await this.processSnapshot(snapshot);
                        this.retryCount = 0; // Reset retry count on success
                    } catch (error) {
                        console.error("Error processing snapshot:", error);
                        await this.handleError(error);
                    } finally {
                        this.isProcessing = false;
                    }
                },
                (error) => {
                    console.error("Error in Firestore listener:", error);
                    this.handleError(error);
                }
            );

            console.log(`Successfully started watcher for ${collectionPath}`);
        } catch (error) {
            console.error(
                `Failed to start watcher for ${collectionPath}:`,
                error
            );
            throw error;
        }
    }

    async stop(): Promise<void> {
        const collectionPath =
            this.collection instanceof CollectionReference
                ? this.collection.path
                : "collection group";
        console.log(`Stopping watcher for collection: ${collectionPath}`);

        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
            console.log(`Successfully stopped watcher for ${collectionPath}`);
        }
    }

    private async handleError(error: any): Promise<void> {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            console.log(`Retrying (${this.retryCount}/${this.maxRetries})...`);
            await new Promise((resolve) =>
                setTimeout(resolve, this.retryDelay * this.retryCount)
            );
            await this.start();
        } else {
            console.error("Max retries reached, stopping watcher");
            await this.stop();
        }
    }

    private async processSnapshot(snapshot: QuerySnapshot): Promise<void> {
        const changes = snapshot.docChanges();
        const collectionPath =
            this.collection instanceof CollectionReference
                ? this.collection.path
                : "collection group";
        console.log(
            `Processing ${changes.length} changes in ${collectionPath}`
        );

        for (const change of changes) {
            const doc = change.doc;
            const data = doc.data();

            try {
                switch (change.type) {
                    case "added":
                    case "modified":
                        setTimeout(() => {
                            console.log(
                                `${collectionPath} - processing - ${doc.id}`
                            );
                            if (adapter.lockedIds.includes(doc.id)) return;
                            this.handleCreateOrUpdate(doc, data);
                        }, 2_000);
                        break;
                    case "removed":
                        console.log(`Document removed: ${doc.id}`);
                        // Handle document removal if needed
                        break;
                }
            } catch (error) {
                console.error(
                    `Error processing ${change.type} for document ${doc.id}:`,
                    error
                );
                // Continue processing other changes even if one fails
            }
        }
    }

    private async handleCreateOrUpdate(
        doc: FirebaseFirestore.QueryDocumentSnapshot<DocumentData>,
        data: DocumentData
    ): Promise<void> {
        const tableParts = doc.ref.path.split("/");
        // -2 cuz -1 gives last entry and we need second last which would
        // be the path specifier
        const tableNameRaw = tableParts[tableParts.length - 2];

        const tableName = tableNameRaw.slice(0, tableNameRaw.length - 1);

        await this.adapter
            .handleChange({
                data: { ...data, id: doc.id },
                tableName,
            })
            .catch((e) => console.error(e));
    }
}
