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
    private retryCount = 0;
    private readonly maxRetries: number = 10; // Increased retries
    private readonly retryDelay: number = 1000; // 1 second
    private isFirstSnapshot = true; // Skip the initial snapshot that contains all existing documents
    
    // Track processed document IDs to prevent duplicates
    private processedIds = new Set<string>();
    private processingIds = new Set<string>();
    
    // Clean up old processed IDs periodically to prevent memory leaks
    private cleanupInterval: NodeJS.Timeout | null = null;
    
    // Connection health monitoring
    private lastSnapshotTime: number = Date.now();
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private readonly healthCheckIntervalMs = 60000; // 1 minute
    private readonly maxTimeWithoutSnapshot = 120000; // 2 minutes - if no snapshot in 2 min, reconnect

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
            // Set up real-time listener (only for new changes, not existing documents)
            this.unsubscribe = this.collection.onSnapshot(
                async (snapshot) => {
                    // Update last snapshot time for health monitoring
                    this.lastSnapshotTime = Date.now();
                    
                    // Skip the first snapshot which contains all existing documents
                    if (this.isFirstSnapshot) {
                        console.log(`Skipping initial snapshot for ${collectionPath} (contains all existing documents)`);
                        this.isFirstSnapshot = false;
                        return;
                    }
                    
                    // Don't skip snapshots - queue them instead to handle large databases
                    // Process snapshot asynchronously without blocking new snapshots
                    this.processSnapshot(snapshot).catch((error) => {
                        console.error("Error processing snapshot:", error);
                        this.handleError(error);
                    });
                    
                    // Reset retry count on successful snapshot receipt
                    this.retryCount = 0;
                },
                (error) => {
                    console.error("Error in Firestore listener:", error);
                    this.handleError(error);
                }
            );

            console.log(`Successfully started watcher for ${collectionPath}`);
            
            // Start cleanup interval to prevent memory leaks
            this.startCleanupInterval();
            
            // Start health check to detect silent disconnects
            this.startHealthCheck();
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
        
        // Stop health check
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
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

    private startHealthCheck(): void {
        // Check connection health periodically
        this.healthCheckInterval = setInterval(() => {
            const timeSinceLastSnapshot = Date.now() - this.lastSnapshotTime;
            const collectionPath =
                this.collection instanceof CollectionReference
                    ? this.collection.path
                    : "collection group";
            
            if (timeSinceLastSnapshot > this.maxTimeWithoutSnapshot) {
                console.warn(
                    `⚠️ Health check failed for ${collectionPath}: No snapshot received in ${timeSinceLastSnapshot}ms. Reconnecting...`
                );
                // Silently reconnect - don't increment retry count for health checks
                this.reconnect();
            }
        }, this.healthCheckIntervalMs);
    }

    private async reconnect(): Promise<void> {
        const collectionPath =
            this.collection instanceof CollectionReference
                ? this.collection.path
                : "collection group";
        
        console.log(`Reconnecting watcher for ${collectionPath}...`);
        
        // Clean up old listener
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        
        // Reset first snapshot flag
        this.isFirstSnapshot = true;
        this.lastSnapshotTime = Date.now();
        
        // Restart the listener
        try {
            await this.start();
        } catch (error) {
            console.error(`Failed to reconnect watcher for ${collectionPath}:`, error);
            // Retry after delay
            setTimeout(() => this.reconnect(), this.retryDelay);
        }
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
        const collectionPath =
            this.collection instanceof CollectionReference
                ? this.collection.path
                : "collection group";
        
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            console.log(`Retrying (${this.retryCount}/${this.maxRetries}) for ${collectionPath}...`);
            await new Promise((resolve) =>
                setTimeout(resolve, this.retryDelay * this.retryCount)
            );
            
            // Clean up old listener before restarting
            if (this.unsubscribe) {
                this.unsubscribe();
                this.unsubscribe = null;
            }
            
            // Reset first snapshot flag when restarting
            this.isFirstSnapshot = true;
            this.lastSnapshotTime = Date.now();
            
            try {
                await this.start();
            } catch (restartError) {
                console.error(`Failed to restart watcher for ${collectionPath}:`, restartError);
                // Continue retrying
                this.handleError(restartError);
            }
        } else {
            console.error(`Max retries reached for ${collectionPath}, but continuing to retry...`);
            // Instead of stopping, reset retry count and keep trying
            this.retryCount = 0;
            await new Promise((resolve) => setTimeout(resolve, this.retryDelay * 5));
            await this.reconnect();
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

        // Process all changes in parallel immediately (no batching)
        const processPromises = changes.map(async (change) => {
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
                            return;
                        }
                        
                        // Check if locked in adapter
                        if (adapter.lockedIds.includes(docId)) {
                            console.log(`${collectionPath} - skipping locked - ${docId}`);
                            return;
                        }

                        // Mark as currently processing
                        this.processingIds.add(docId);
                        
                        try {
                            // Process immediately
                            console.log(`${collectionPath} - processing - ${docId}`);
                            await this.handleCreateOrUpdate(doc, data);
                            
                            // Mark as processed
                            this.processedIds.add(docId);
                        } finally {
                            this.processingIds.delete(docId);
                        }
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
        });

        // Process all changes in parallel
        await Promise.all(processPromises);
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
