import type { Timestamp } from 'firebase/firestore';
import type {
    DocumentData,
    QueryDocumentSnapshot,
    WithFieldValue
} from 'firebase/firestore';

export type ChatType = 'direct' | 'group';

export type Chat = {
    id: string;
    type?: ChatType; // Make type optional for backward compatibility
    name?: string; // Required for group chats
    description?: string;
    photoURL?: string; // Group profile picture URL
    participants: string[]; // Array of user IDs
    owner?: string; // Required User ID of the chat owner in group chats
    admins?: string[]; // Required Array of user IDs for group chats
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastMessage?: {
        text: string;
        senderId: string;
        timestamp: Timestamp;
    };
};

// Helper function to derive chat type from participant count
export function deriveChatType(participants: string[]): ChatType {
    return participants.length > 2 ? 'group' : 'direct';
}

// Helper function to get chat type (with fallback for backward compatibility)
export function getChatType(chat: Chat): ChatType {
    if (chat.type) {
        return chat.type; // Use explicit type if it exists (backward compatibility)
    }
    return deriveChatType(chat.participants); // Derive from participant count
}

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
