import type { Timestamp } from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot, WithFieldValue } from 'firebase/firestore';

export type ChatType = 'direct' | 'group';

export type Chat = {
    id: string;
    type: ChatType;
    name?: string; // Required for group chats
    participants: string[]; // Array of user IDs
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastMessage?: {
        text: string;
        senderId: string;
        timestamp: Timestamp;
    };
};

export const chatConverter = {
    toFirestore(chat: WithFieldValue<Chat>): DocumentData {
        return chat;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): Chat {
        const data = snapshot.data();
        return {
            id: snapshot.id,
            ...data
        } as Chat;
    }
}; 