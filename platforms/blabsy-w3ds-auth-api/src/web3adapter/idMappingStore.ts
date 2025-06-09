import { getFirestore } from "firebase-admin/firestore";
import { IDMappingStore } from "./types";

const COLLECTION_MAP = {
    user: "users",
    socialMediaPost: "tweets",
    message: "messages",
    chat: "chats",
} as const;

export class FirestoreIDMappingStore implements IDMappingStore {
    private readonly db = getFirestore();

    private getCollectionRef(entityType: string) {
        const collectionName =
            COLLECTION_MAP[entityType as keyof typeof COLLECTION_MAP];
        if (!collectionName) {
            throw new Error(`Unknown entity type: ${entityType}`);
        }
        return this.db.collection("web3_mappings").doc(collectionName);
    }

    async store(
        platformId: string,
        metaEnvelopeId: string,
        entityType: string
    ): Promise<void> {
        const collectionRef = this.getCollectionRef(entityType);

        if (entityType === "message") {
            // For messages, we need to extract chatId from the platformId
            const [chatId, messageId] = platformId.split("/");
            if (!chatId || !messageId) {
                throw new Error(
                    "Invalid message platformId format. Expected: chatId/messageId"
                );
            }

            await collectionRef.collection(chatId).doc(messageId).set({
                platformId: messageId,
                metaEnvelopeId,
                entityType,
                chatId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        } else {
            await collectionRef.collection("mappings").doc(platformId).set({
                platformId,
                metaEnvelopeId,
                entityType,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
    }

    async getMetaEnvelopeId(
        platformId: string,
        entityType: string
    ): Promise<string | null> {
        const collectionRef = this.getCollectionRef(entityType);

        if (entityType === "message") {
            const [chatId, messageId] = platformId.split("/");
            if (!chatId || !messageId) {
                throw new Error(
                    "Invalid message platformId format. Expected: chatId/messageId"
                );
            }

            const doc = await collectionRef
                .collection(chatId)
                .doc(messageId)
                .get();
            return doc.exists ? doc.data()?.metaEnvelopeId || null : null;
        } else {
            const doc = await collectionRef
                .collection("mappings")
                .doc(platformId)
                .get();
            return doc.exists ? doc.data()?.metaEnvelopeId || null : null;
        }
    }

    async getPlatformId(
        metaEnvelopeId: string,
        entityType: string
    ): Promise<string | null> {
        const collectionRef = this.getCollectionRef(entityType);

        if (entityType === "message") {
            // For messages, we need to search through all chat subcollections
            const chatsSnapshot = await collectionRef.listCollections();

            for (const chatCollection of chatsSnapshot) {
                const query = await chatCollection
                    .where("metaEnvelopeId", "==", metaEnvelopeId)
                    .limit(1)
                    .get();

                if (!query.empty) {
                    const data = query.docs[0].data();
                    return `${data?.chatId}/${data?.platformId}`;
                }
            }
            return null;
        } else {
            const query = await collectionRef
                .collection("mappings")
                .where("metaEnvelopeId", "==", metaEnvelopeId)
                .limit(1)
                .get();

            return query.empty
                ? null
                : query.docs[0].data()?.platformId || null;
        }
    }
}

