import { getFirestore } from "firebase-admin/firestore";
import { FirestoreWatcher } from "./watchers/firestoreWatcher";

export interface Web3AdapterConfig {
    registryUrl: string;
    webhookSecret: string;
    webhookEndpoint: string;
    pictiqueWebhookUrl: string;
    pictiqueWebhookSecret: string;
}

export class Web3Adapter {
    private readonly db = getFirestore();
    private watchers: FirestoreWatcher<any>[] = [];

    constructor(private config: Web3AdapterConfig) {}

    async initialize(): Promise<void> {
        // Initialize watchers for each collection
        const collections = [
            { name: "users", type: "user" },
            { name: "tweets", type: "socialMediaPost" },
            { name: "messages", type: "message" },
            { name: "comments", type: "comment" },
        ];

        for (const { name, type } of collections) {
            const collection = this.db.collection(name);
            const watcher = new FirestoreWatcher(collection);
            await watcher.start();
            this.watchers.push(watcher);
        }
    }

    async shutdown(): Promise<void> {
        // Stop all watchers
        await Promise.all(this.watchers.map((watcher) => watcher.stop()));
        this.watchers = [];
    }
}
