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
    private watcherStartTime: number = Date.now(); // Track when watcher starts
    private firstSnapshotReceived = false; // Track if we've received the first snapshot
    
    // Track processed document IDs to prevent duplicates
    private processedIds = new Set<string>();
    private processingIds = new Set<string>();
    private processedIdTimers = new Map<string, NodeJS.Timeout>();
    private readonly duplicateBlockDurationMs = 5000; // Only block duplicates for 5s
    
    // Clean up old processed IDs periodically to prevent memory leaks
    private cleanupInterval: NodeJS.Timeout | null = null;
    
    // Connection health monitoring
    private lastSnapshotTime: number = Date.now();
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private readonly healthCheckIntervalMs = 60000; // 1 minute
    private readonly maxTimeWithoutSnapshot = 120000; // 2 minutes - if no snapshot in 2 min, reconnect
    
    // Reconnection policy
    private currentAttempt = 0;
    private readonly maxAttempts = 20; // Maximum reconnection attempts
    private readonly baseDelay = 1000; // Base delay in ms
    private readonly maxDelay = 60000; // Maximum delay cap (60 seconds)
    private reconnectTimeoutId: NodeJS.Timeout | null = null;
    private stopped = false; // Flag to stop reconnection attempts

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

        // Reset stopped flag when starting
        this.stopped = false;
        
        // Reset watcher start time
        this.watcherStartTime = Date.now();
        this.firstSnapshotReceived = false;

        try {
            // Set up real-time listener
            this.unsubscribe = this.collection.onSnapshot(
                async (snapshot) => {
                    // Update last snapshot time for health monitoring
                    this.lastSnapshotTime = Date.now();
                    
                    // On first snapshot, only skip documents that were created/modified BEFORE watcher started
                    // This ensures we don't miss any new documents created right as the watcher starts
                    if (!this.firstSnapshotReceived) {
                        console.log(`First snapshot received for ${collectionPath} with ${snapshot.size} documents`);
                        this.firstSnapshotReceived = true;
                        
                        // Process only documents modified AFTER watcher start time
                        const recentChanges = snapshot.docChanges().filter((change) => {
                            const doc = change.doc;
                            const data = doc.data();
                            
                            // Check if document was modified after watcher started
                            // Use updatedAt if available, otherwise createdAt
                            const timestamp = data.updatedAt || data.createdAt;
                            if (timestamp && timestamp.toMillis) {
                                const docTime = timestamp.toMillis();
                                return docTime >= this.watcherStartTime;
                            }
                            
                            // If no timestamp, process it to be safe
                            return true;
                        });
                        
                        if (recentChanges.length > 0) {
                            console.log(`Processing ${recentChanges.length} recent changes from first snapshot`);
                            await this.processChanges(recentChanges);
                        } else {
                            console.log(`No recent changes in first snapshot, skipping`);
                        }
                        
                        this.retryCount = 0;
                        return;
                    }
                    
                    // For subsequent snapshots, process all changes normally
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

        // Set stopped flag to prevent new reconnection attempts
        this.stopped = true;

        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
            console.log(`Successfully stopped watcher for ${collectionPath}`);
        }

        // Clear any in-memory duplicate tracking
        this.clearProcessedIds();
        
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
        
        // Clear any pending reconnect timeout
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }
    }

    private startCleanupInterval(): void {
        // Clean up processed IDs every 5 minutes to prevent memory leaks
        this.cleanupInterval = setInterval(() => {
            const beforeSize = this.processedIds.size;
            this.clearProcessedIds();
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
                // Use async IIFE to properly await and handle errors
                (async () => {
                    try {
                        await this.reconnect();
                    } catch (error) {
                        console.error(`Error during health-check reconnect for ${collectionPath}:`, error);
                    }
                })();
            }
        }, this.healthCheckIntervalMs);
    }

    private async reconnect(): Promise<void> {
        const collectionPath =
            this.collection instanceof CollectionReference
                ? this.collection.path
                : "collection group";
        
        console.log(`Reconnecting watcher for ${collectionPath}...`);
        
        // Clear existing intervals before restarting
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        // Clear any pending reconnect timeout
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }
        
        // Clean up old listener
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        
        // Reset watcher state
        this.watcherStartTime = Date.now();
        this.firstSnapshotReceived = false;
        this.lastSnapshotTime = Date.now();
        
        // Reset reconnection attempt counter on successful reconnect
        this.currentAttempt = 0;
        
        // Restart the listener
        try {
            await this.start();
        } catch (error) {
            console.error(`Failed to reconnect watcher for ${collectionPath}:`, error);
            // Schedule retry with exponential backoff
            this.scheduleReconnect();
        }
    }
    
    /**
     * Schedules a reconnection attempt with exponential backoff
     */
    private scheduleReconnect(): void {
        if (this.stopped) {
            console.error("Watcher is stopped, not scheduling reconnect");
            return;
        }
        
        if (this.currentAttempt >= this.maxAttempts) {
            console.error(`Max reconnection attempts (${this.maxAttempts}) reached. Stopping reconnection attempts.`);
            this.stopped = true;
            return;
        }
        
        // Clear any existing timeout
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }
        
        this.currentAttempt++;
        
        // Calculate exponential backoff with jitter
        const exponentialDelay = Math.min(
            this.baseDelay * Math.pow(2, this.currentAttempt - 1),
            this.maxDelay
        );
        // Add jitter: ±20% of the delay
        const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
        const delay = Math.floor(exponentialDelay + jitter);
        
        const collectionPath =
            this.collection instanceof CollectionReference
                ? this.collection.path
                : "collection group";
        
        console.log(`Scheduling reconnect attempt ${this.currentAttempt}/${this.maxAttempts} for ${collectionPath} in ${delay}ms`);
        
        this.reconnectTimeoutId = setTimeout(async () => {
            this.reconnectTimeoutId = null;
            try {
                await this.reconnect();
            } catch (error) {
                console.error(`Error during scheduled reconnect for ${collectionPath}:`, error);
                // Schedule another attempt
                this.scheduleReconnect();
            }
        }, delay);
    }

    // Method to manually clear processed IDs (useful for debugging)
    clearProcessedIds(): void {
        const beforeSize = this.processedIds.size;
        this.processedIds.clear();
        // Clear and reset any pending expiry timers
        for (const timer of this.processedIdTimers.values()) {
            clearTimeout(timer);
        }
        this.processedIdTimers.clear();
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
        
        // Clear existing intervals before restarting
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        // Clear any pending reconnect timeout
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }
        
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
            
            // Reset watcher state when restarting
            this.watcherStartTime = Date.now();
            this.firstSnapshotReceived = false;
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

    /**
     * Processes an array of document changes
     */
    private async processChanges(changes: DocumentChange[]): Promise<void> {
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
                            this.markAsProcessed(docId);
                        } finally {
                            this.processingIds.delete(docId);
                        }
                        break;
                        
                    case "removed":
                        console.log(`Document removed: ${docId}`);
                        // Remove from processed IDs when document is deleted
                        this.processedIds.delete(docId);
                        const timer = this.processedIdTimers.get(docId);
                        if (timer) {
                            clearTimeout(timer);
                            this.processedIdTimers.delete(docId);
                        }
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

    private async processSnapshot(snapshot: QuerySnapshot): Promise<void> {
        const changes = snapshot.docChanges();
        await this.processChanges(changes);
    }

    /**
     * Marks a document as processed and schedules its removal after a short window.
     */
    private markAsProcessed(docId: string): void {
        // Reset any existing timer for this doc
        const existingTimer = this.processedIdTimers.get(docId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        this.processedIds.add(docId);

        const timer = setTimeout(() => {
            this.processedIds.delete(docId);
            this.processedIdTimers.delete(docId);
        }, this.duplicateBlockDurationMs);

        this.processedIdTimers.set(docId, timer);
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
