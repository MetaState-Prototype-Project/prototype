import { getFirestore } from "firebase-admin/firestore";
import { FirestoreWatcher } from "./watchers/firestoreWatcher";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

export interface Web3AdapterConfig {
    registryUrl: string;
    webhookSecret: string;
    webhookEndpoint: string;
    pictiqueWebhookUrl: string;
    pictiqueWebhookSecret: string;
}

export class Web3Adapter {
    private readonly db = getFirestore();
    private watchers: Map<string, FirestoreWatcher> = new Map();

    async initialize(): Promise<void> {
        console.log("Initializing Web3Adapter...");

        // Initialize watchers for each collection
        const collections = [
            { name: "users", type: "user" },
            { name: "tweets", type: "socialMediaPost" },
            { name: "chats", type: "message" },
            { name: "comments", type: "comment" },
        ];

        for (const { name, type } of collections) {
            try {
                console.log(`Setting up watcher for collection: ${name}`);
                const collection = this.db.collection(name);
                const watcher = new FirestoreWatcher(collection);
                await watcher.start();
                this.watchers.set(name, watcher);
                console.log(`Successfully set up watcher for ${name}`);

                // Special handling for messages using collection group
                if (name === "chats") {
                    const messagesWatcher = new FirestoreWatcher(
                        this.db.collectionGroup("messages")
                    );
                    await messagesWatcher.start();
                    this.watchers.set("messages", messagesWatcher);
                    console.log("Successfully set up watcher for all messages");
                }
            } catch (error) {
                console.error(`Failed to set up watcher for ${name}:`, error);
            }
        }

        // Set up error handling for watchers
        process.on("unhandledRejection", (error) => {
            console.error("Unhandled promise rejection in watchers:", error);
            // Attempt to restart watchers
            this.restartWatchers();
        });
    }

    private async restartWatchers(): Promise<void> {
        console.log("Attempting to restart watchers...");

        // Stop all existing watchers
        await this.shutdown();

        // Wait a bit before restarting
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Reinitialize watchers
        await this.initialize();
    }

    async shutdown(): Promise<void> {
        console.log("Shutting down Web3Adapter...");

        // Stop all watchers
        const stopPromises = Array.from(this.watchers.values()).map(
            async (watcher) => {
                try {
                    await watcher.stop();
                } catch (error) {
                    console.error("Error stopping watcher:", error);
                }
            }
        );

        await Promise.all(stopPromises);
        this.watchers.clear();
        console.log("All watchers stopped");
    }

    // Method to manually trigger a watcher restart
    async restartWatcher(collectionName: string): Promise<void> {
        const watcher = this.watchers.get(collectionName);
        if (watcher) {
            console.log(`Restarting watcher for ${collectionName}...`);
            await watcher.stop();
            const collection = this.db.collection(collectionName);
            const newWatcher = new FirestoreWatcher(collection);
            await newWatcher.start();
            this.watchers.set(collectionName, newWatcher);
            console.log(`Successfully restarted watcher for ${collectionName}`);
        }
    }
}
