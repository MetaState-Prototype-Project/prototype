import {
    DocumentChange,
    DocumentData,
    QuerySnapshot,
} from "firebase-admin/firestore";
import { Web3Adapter } from "../../../../../infrastructure/web3-adapter/src/index";
import path from "path";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

export class FirestoreWatcher<T extends DocumentData> {
    private unsubscribe: (() => void) | null = null;
    private adapter: Web3Adapter;
    constructor(
        private readonly collection: FirebaseFirestore.CollectionReference
    ) {
        this.adapter = new Web3Adapter({
            schemasPath: path.resolve(__dirname, "../mappings/"),
            dbPath: path.resolve(process.env.BLABSY_MAPPING_DB_PATH as string),
            registryUrl: process.env.PUBLIC_REGISTRY_URL as string,
        });
    }

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
                        await this.handleCreateOrUpdate(doc, data);
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

    private async handleCreateOrUpdate(
        doc: FirebaseFirestore.QueryDocumentSnapshot<
            DocumentData,
            DocumentData
        >,
        data: T
    ): Promise<void> {
        const tableName = doc.ref.path.split("s/")[0];
        const envelope = await this.adapter.handleChange({
            data: { ...data, id: doc.id },
            tableName,
        });
        axios.post(
            new URL(
                "/api/webhook",
                process.env.PUBLIC_PICTIQUE_BASE_URL
            ).toString(),
            envelope
        );
    }
}
