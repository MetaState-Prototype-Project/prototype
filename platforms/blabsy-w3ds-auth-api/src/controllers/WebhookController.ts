import { Request, Response } from "express";
import { Web3Adapter } from "../../../../infrastructure/web3-adapter/src/index";
import path from "path";
import dotenv from "dotenv";
import { getFirestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import axios from "axios";

// Define types locally since we can't import from @blabsy/types
type User = {
    id: string;
    bio: string | null;
    name: string;
    theme: string | null;
    accent: string | null;
    website: string | null;
    location: string | null;
    username: string;
    photoURL: string;
    verified: boolean;
    following: string[];
    followers: string[];
    createdAt: Timestamp;
    updatedAt: Timestamp | null;
    totalTweets: number;
    totalPhotos: number;
    pinnedTweet: string | null;
    coverPhotoURL: string | null;
};

type Tweet = {
    id: string;
    text: string | null;
    images: any | null;
    parent: { id: string; username: string } | null;
    userLikes: string[];
    createdBy: string;
    createdAt: Timestamp;
    updatedAt: Timestamp | null;
    userReplies: number;
    userRetweets: string[];
};

type Chat = {
    id: string;
    type: "direct" | "group";
    name?: string;
    participants: string[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastMessage?: {
        text: string;
        senderId: string;
        timestamp: Timestamp;
    };
};

type Message = {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    readBy: string[];
};

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

export const adapter = new Web3Adapter({
    schemasPath: path.resolve(__dirname, "../web3adapter/mappings/"),
    dbPath: path.resolve(process.env.BLABSY_MAPPING_DB_PATH as string),
    registryUrl: process.env.PUBLIC_REGISTRY_URL as string,
    platform: process.env.PUBLIC_BLABSY_BASE_URL as string,
});

export class WebhookController {
    db: FirebaseFirestore.Firestore;

    constructor() {
        this.db = getFirestore();
        // Bind the method to preserve 'this' context
        this.handleWebhook = this.handleWebhook.bind(this);
    }

    async handleWebhook(req: Request, res: Response) {
        try {
            const { data, schemaId, id } = req.body;

            if (process.env.ANCHR_URL) {
                axios.post(new URL("blabsy", process.env.ANCHR_URL).toString(), req.body)
            }

            if (adapter.lockedIds.includes(id)) return;
            console.log("processing -- not skipped");
            adapter.addToLockedIds(id);

            const mapping = Object.values(adapter.mapping).find(
                (m) => m.schemaId === schemaId,
            );
            if (!mapping) throw new Error();
            const tableName = mapping.tableName + "s";

            const local = await adapter.fromGlobal({ data, mapping });

            console.log(local);
            //
            // Get the local ID from the mapping database
            const localId = await adapter.mappingDb.getLocalId(id);

            if (localId) {
                console.log("LOCAL, updating");
                adapter.addToLockedIds(localId);
                await this.updateRecord(tableName, localId, local.data);
            } else {
                console.log("NOT LOCAL, creating");
                await this.createRecord(tableName, local.data, req.body.id);
            }

            res.status(200).json({ success: true });
        } catch (error) {
            console.error("Error handling webhook:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    private async createRecord(tableName: string, data: any, globalId: string) {
        const chatId = data.chatId
            ? data.chatId.split("(")[1].split(")")[0]
            : null;

        let collection;
        if (tableName === "messages" && data.chatId) {
            collection = this.db.collection(`chats/${chatId}/messages`);
        } else {
            collection = this.db.collection(tableName);
        }

        let docRef = collection.doc();

        const mappedData = await this.mapDataToFirebase(tableName, data);
        if (tableName === "users") {
            docRef = collection.doc(data.ename);
        } else {
            // Use auto-generated ID for other tables
            docRef = collection.doc();
        }
        await docRef.set(mappedData);

        adapter.addToLockedIds(docRef.id);
        adapter.addToLockedIds(globalId);
        await adapter.mappingDb.storeMapping({
            globalId: globalId,
            localId: docRef.id,
        });
    }

    private async updateRecord(tableName: string, localId: string, data: any) {
        const collection = this.db.collection(tableName);
        const docRef = collection.doc(localId);

        adapter.addToLockedIds(docRef.id);

        const docSnapshot = await docRef.get();

        if (!docSnapshot.exists) {
            console.warn(
                `Document with ID '${localId}' does not exist in '${tableName}'. Skipping update.`,
            );
            return;
        }

        const mappedData = await this.mapDataToFirebase(tableName, data);
        await docRef.update(mappedData);
    }
    private mapDataToFirebase(tableName: string, data: any): any {
        const now = Timestamp.now();
        console.log("MAPPING DATA TO ", tableName);

        switch (tableName) {
            case "users":
                const result = this.mapUserData(data, now);
                console.log("mappppped", result);
                return result;
            case "tweets":
                return this.mapTweetData(data, now);
            case "chats":
                return this.mapChatData(data, now);
            case "messages":
                return this.mapMessageData(data, now);
            default:
                return data;
        }
    }

    private mapUserData(data: any, now: Timestamp): Partial<User> {
        let userData: Record<string, any> = {
            bio: data.bio || null,
            name: data.name,
            theme: data.theme || null,
            accent: data.accent || null,
            website: null,
            location: null,
            username: data.username || data.ename.split("@")[1],
            photoURL: data.photoURL ?? "/assets/twitter-avatar.jpg",
            verified: data.verified || false,
            following: data.following || [],
            followers: data.followers || [],
            createdAt: data.createdAt
                ? Timestamp.fromDate(new Date(data.createdAt))
                : now,
            updatedAt: now,
            totalTweets: data.totalTweets || 0,
            totalPhotos: data.totalPhotos || 0,
            pinnedTweet: data.pinnedTweet || null,
            coverPhotoURL: data.coverPhotoURL || null,
        };
        if (data.ename) userData.id = data.ename;
        return userData;
    }

    private async mapTweetData(
        data: any,
        now: Timestamp,
    ): Promise<Partial<Tweet>> {
        let createdBy = data.createdBy;
        if (createdBy.includes("(") && createdBy.includes(")")) {
            createdBy = createdBy.split("(")[1].split(")")[0];
        }
        const filteredResult = {};
        for (const key of Object.keys(data)) {
            if (data[key]) {
                // @ts-ignore
                filteredResult[key] = data[key];
            }
        }
        const usersCollectionRef = this.db.collection("users");
        const user = (await usersCollectionRef.doc(createdBy).get()).data();

        const tweetData = {
            ...filteredResult,
            userLikes: data.userLikes
                .filter((l: string) => !!l)
                .map((u: string) => {
                    if (u.includes("(") && u.includes(")")) {
                        return u.split("(")[1].split(")")[0];
                    } else {
                        return u;
                    }
                }),
            createdBy,
            images: data.images
                ? data.images.map((i: string) => ({
                    src: i,
                }))
                : null,
            parent:
                data.parent && user
                    ? {
                        id: data.parent.split("(")[1].split(")")[0],
                        username: user.username,
                    }
                    : null,
            createdAt: Timestamp.fromDate(new Date(Date.now())),
            userRetweets: [],
            userReplies: 0,
        };
        return tweetData;
    }

    private mapChatData(data: any, now: Timestamp): Partial<Chat> {
        return {
            type: data.type || "direct",
            name: data.name,
            participants:
                data.participants.map(
                    (p: string) => p.split("(")[1].split(")")[0],
                ) || [],
            createdAt: data.createdAt
                ? Timestamp.fromDate(new Date(data.createdAt))
                : now,
            updatedAt: now,
            lastMessage: data.lastMessage
                ? {
                    ...data.lastMessage,
                    timestamp: Timestamp.fromDate(
                        new Date(data.lastMessage.timestamp),
                    ),
                }
                : null,
        };
    }

    private mapMessageData(data: any, now: Timestamp): Partial<Message> {
        return {
            chatId: data.chatId.split("(")[1].split(")")[0],
            senderId: data.senderId.split("(")[1].split(")")[0],
            text: data.text,
            createdAt: data.createdAt
                ? Timestamp.fromDate(new Date(data.createdAt))
                : now,
            updatedAt: now,
            readBy: data.readBy || [],
        };
    }
}
