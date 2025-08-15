import { useState, useEffect, useContext, createContext, useMemo } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    limit,
    Timestamp
} from 'firebase/firestore';
import { db } from '@lib/firebase/app';
import {
    chatsCollection,
    chatMessagesCollection
} from '@lib/firebase/collections';
import {
    createChat,
    sendMessage,
    markMessageAsRead,
    addParticipantToChat,
    removeParticipantFromChat
} from '@lib/firebase/utils';
import { useAuth } from './auth-context';
import type { ReactNode } from 'react';
import type { Chat } from '@lib/types/chat';
import type { Message } from '@lib/types/message';

type ChatContext = {
    chats: Chat[] | null;
    currentChat: Chat | null;
    messages: Message[] | null;
    loading: boolean;
    error: Error | null;
    setCurrentChat: (chat: Chat | null) => void;
    createNewChat: (
        participants: string[],
        name?: string
    ) => Promise<string>;
    sendNewMessage: (text: string) => Promise<void>;
    markAsRead: (messageId: string) => Promise<void>;
    addParticipant: (userId: string) => Promise<void>;
    removeParticipant: (userId: string) => Promise<void>;
};

const ChatContext = createContext<ChatContext | null>(null);

type ChatContextProviderProps = {
    children: ReactNode;
};

export function ChatContextProvider({
    children
}: ChatContextProviderProps): JSX.Element {
    const { user } = useAuth();
    const [chats, setChats] = useState<Chat[] | null>(null);
    const [currentChat, setCurrentChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Listen to user's chats
    useEffect(() => {
        if (!user) {
            // setChats(null);
            // setLoading(false);
            setChats([
                {
                    id: 'dummy-chat-1',
                    participants: ['user_1', 'user_2'],
                    createdAt: Timestamp.fromDate(new Date()),
                    updatedAt: Timestamp.fromDate(new Date()),
                    lastMessage: {
                        senderId: 'user_1',
                        text: 'Hey, how are you?',
                        timestamp: Timestamp.fromDate(new Date())
                    },
                    name: 'Chat with User 2'
                },
                {
                    id: 'dummy-chat-2',
                    participants: ['user_1', 'user_3', 'user_4'],
                    owner: 'user_1',
                    admins: ['user_3'],
                    createdAt: Timestamp.fromDate(new Date()),
                    updatedAt: Timestamp.fromDate(new Date()),
                    lastMessage: {
                        senderId: 'user_4',
                        text: 'Let’s meet tomorrow.',
                        timestamp: Timestamp.fromDate(new Date())
                    },
                    name: 'Project Team'
                }
            ]);
            setLoading(false);
            return;
        }

        const chatsQuery = query(
            chatsCollection,
            where('participants', 'array-contains', user.id)
        );

        const unsubscribe = onSnapshot(
            chatsQuery,
            (snapshot) => {
                const chatsData = snapshot.docs.map((doc) => doc.data());
                setChats(chatsData);
                setLoading(false);
            },
            (error) => {
                // eslint-disable-next-line no-console
                console.error('[ChatContext] Error in chat listener:', error);
                setError(error as Error);
                setLoading(false);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [user]);

    // Listen to current chat messages
    useEffect(() => {
        if (!currentChat) {
            setMessages(null);
            return;
        }

        const messagesQuery = query(
            chatMessagesCollection(currentChat.id),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(
            messagesQuery,
            (snapshot) => {
                const messagesData = snapshot.docs.map((doc) => doc.data());
                setMessages(messagesData);
            },
            (error) => {
                setError(error as Error);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [currentChat]);

    const createNewChat = async (
        participants: string[],
        name?: string,
        description?: string
    ): Promise<string> => {
        try {
            if (!user) {
                throw new Error('User must be logged in to create a chat');
            }

            const chatId = await createChat(
                participants,
                name,
                participants.length > 2 ? user.id : undefined,
                description
            );
            return chatId;
        } catch (error) {
            setError(error as Error);
            throw error;
        }
    };

    const sendNewMessage = async (text: string): Promise<void> => {
        if (!user || !currentChat) return;

        try {
            await sendMessage(currentChat.id, user.id, text);
        } catch (error) {
            setError(error as Error);
            throw error;
        }
    };

    const markAsRead = async (messageId: string): Promise<void> => {
        if (!user || !currentChat) return;

        try {
            await markMessageAsRead(currentChat.id, messageId, user.id);
        } catch (error) {
            setError(error as Error);
            throw error;
        }
    };

    const addParticipant = async (userId: string): Promise<void> => {
        if (!currentChat) return;

        try {
            await addParticipantToChat(currentChat.id, userId);
        } catch (error) {
            setError(error as Error);
            throw error;
        }
    };

    const removeParticipant = async (userId: string): Promise<void> => {
        if (!currentChat) return;

        try {
            await removeParticipantFromChat(currentChat.id, userId);
        } catch (error) {
            setError(error as Error);
            throw error;
        }
    };

    const value: ChatContext = {
        chats,
        currentChat,
        messages,
        loading,
        error,
        setCurrentChat,
        createNewChat,
        sendNewMessage,
        markAsRead,
        addParticipant,
        removeParticipant
    };

    return (
        <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
    );
}

export function useChat(): ChatContext {
    const context = useContext(ChatContext);

    if (!context)
        throw new Error('useChat must be used within a ChatContextProvider');

    return context;
}
