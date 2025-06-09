import type { Timestamp } from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot, WithFieldValue } from 'firebase/firestore';

export type Message = {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    readBy: string[]; // Array of user IDs who have read the message
};

export const messageConverter = {
    toFirestore(message: WithFieldValue<Message>): DocumentData {
        return message;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): Message {
        const data = snapshot.data();
        return {
            id: snapshot.id,
            ...data
        } as Message;
    }
}; 