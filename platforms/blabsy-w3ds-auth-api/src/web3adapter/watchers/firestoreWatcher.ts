import {
    DocumentChange,
    DocumentData,
    QuerySnapshot,
    CollectionReference,
    CollectionGroup,
} from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import dotenv from "dotenv";
import { adapter } from "../../controllers/WebhookController";
dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

export class FirestoreWatcher {
    private unsubscribe: (() => void) | null = null;
    private adapter = adapter;
    private db: FirebaseFirestore.Firestore;
    private isProcessing = false;
    private retryCount = 0;
    private readonly maxRetries: number = 3;
    private readonly retryDelay: number = 1000; // 1 second
    
    // Track processed document IDs to prevent duplicates
    private processedIds = new Set<string>();
    private processingIds = new Set<string>();
    
    // Clean up old processed IDs periodically to prevent memory leaks
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(
        private readonly collection:
            | CollectionReference<DocumentData>
            | CollectionGroup<DocumentData>
    ) {
        this.db = getFirestore();
    }

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
            
            // Start cleanup interval to prevent memory leaks
            this.startCleanupInterval();
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
        
        // Stop cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    private startCleanupInterval(): void {
        // Clean up processed IDs every 5 minutes to prevent memory leaks
        this.cleanupInterval = setInterval(() => {
            const beforeSize = this.processedIds.size;
            this.processedIds.clear();
            const afterSize = this.processedIds.size;
            console.log(`Cleaned up processed IDs: ${beforeSize} -> ${afterSize}`);
        }, 5 * 60 * 1000); // 5 minutes
    }

    // Method to manually clear processed IDs (useful for debugging)
    clearProcessedIds(): void {
        const beforeSize = this.processedIds.size;
        this.processedIds.clear();
        console.log(`Manually cleared processed IDs: ${beforeSize} -> 0`);
    }

    // Method to get current stats for debugging
    getStats(): { processed: number; processing: number } {
        return {
            processed: this.processedIds.size,
            processing: this.processingIds.size
        };
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
            const docId = doc.id;
            const data = doc.data();

            try {
                switch (change.type) {
                    case "added":
                    case "modified":
                        // Check if already processed or currently processing
                        if (this.processedIds.has(docId) || this.processingIds.has(docId)) {
                            console.log(`${collectionPath} - skipping duplicate/processing - ${docId}`);
                            continue;
                        }
                        
                        // Check if locked in adapter
                        if (adapter.lockedIds.includes(docId)) {
                            console.log(`${collectionPath} - skipping locked - ${docId}`);
                            continue;
                        }

                        // Mark as currently processing
                        this.processingIds.add(docId);
                        
                        // Process immediately without setTimeout to prevent race conditions
                        console.log(`${collectionPath} - processing - ${docId}`);
                        await this.handleCreateOrUpdate(doc, data);
                        
                        // Mark as processed and remove from processing
                        this.processedIds.add(docId);
                        this.processingIds.delete(docId);
                        break;
                        
                    case "removed":
                        console.log(`Document removed: ${docId}`);
                        // Remove from processed IDs when document is deleted
                        this.processedIds.delete(docId);
                        this.processingIds.delete(docId);
                        break;
                }
            } catch (error) {
                console.error(
                    `Error processing ${change.type} for document ${docId}:`,
                    error
                );
                // Remove from processing IDs on error
                this.processingIds.delete(docId);
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

        // If this is a message, fetch and attach the full chat details
        let enrichedData: DocumentData & { id: string; chat?: DocumentData } = { ...data, id: doc.id };
        
        console.log("----------------")
        console.log("----------------")
        console.log("----------------")
        console.log("tableName", tableName)
        console.log("----------------")
        console.log("----------------")
        console.log("----------------")
        console.log("----------------")
        
        if (tableName === "message" && data.chatId) {

            try {
                console.log(`Fetching chat details for message ${doc.id} in chat ${data.chatId}`);
                const chatDoc = await this.getChatDetails(data.chatId);
                if (chatDoc) {
                    enrichedData = {
                        ...enrichedData,
                        chat: chatDoc
                    };
                    console.log(`✅ Chat details attached to message ${doc.id}`);
                } else {
                    console.log(`⚠️ Chat not found for message ${doc.id} in chat ${data.chatId}`);
                }
            } catch (error) {
                console.error(`❌ Error fetching chat details for message ${doc.id}:`, error);
                // Continue processing even if chat fetch fails
            }
        }

        await this.adapter
            .handleChange({
                data: enrichedData,
                tableName,
            })
            .catch((e) => console.error(e));
    }

    /**
     * Fetches the full chat details for a given chat ID
     */
    private async getChatDetails(chatId: string): Promise<DocumentData | null> {
        try {
            // Fetch the chat document using the class's Firestore instance
            const chatDoc = await this.db.collection("chats").doc(chatId).get();
            
            if (chatDoc.exists) {
                const chatData = chatDoc.data();
                if (chatData) {
                    // Add the chat ID to the data
                    return {
                        ...chatData,
                        id: chatId
                    };
                }
            }
            
            return null;
        } catch (error) {
            console.error(`Error fetching chat details for chat ${chatId}:`, error);
            return null;
        }
    }
}
