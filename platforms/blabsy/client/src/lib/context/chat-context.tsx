import { useState, useEffect, useContext, createContext, useMemo, useCallback } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    limit,
    Timestamp,
    getDocs,
    startAfter,
    QueryDocumentSnapshot
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

const MESSAGES_PER_PAGE = 30;

type ChatContext = {
    chats: Chat[] | null;
    currentChat: Chat | null;
    messages: Message[] | null;
    loading: boolean;
    error: Error | null;
    hasMoreMessages: boolean;
    loadingOlderMessages: boolean;
    setCurrentChat: (chat: Chat | null) => void;
    createNewChat: (participants: string[], name?: string) => Promise<string>;
    sendNewMessage: (text: string) => Promise<void>;
    markAsRead: (messageId: string) => Promise<void>;
    addParticipant: (userId: string) => Promise<void>;
    removeParticipant: (userId: string) => Promise<void>;
    loadOlderMessages: () => Promise<void>;
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
    const [realtimeMessages, setRealtimeMessages] = useState<Message[] | null>(null);
    const [olderMessages, setOlderMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
    const [oldestDocSnapshot, setOldestDocSnapshot] = useState<QueryDocumentSnapshot | null>(null);

    // Merge realtime + older messages, deduplicating by id
    const messages = useMemo(() => {
        if (!realtimeMessages) return null;

        const messageMap = new Map<string, Message>();

        // Add older messages first
        for (const msg of olderMessages) {
            messageMap.set(msg.id, msg);
        }

        // Realtime messages overwrite any overlapping older ones
        for (const msg of realtimeMessages) {
            messageMap.set(msg.id, msg);
        }

        // Sort descending by createdAt (matching the existing convention; UI reverses for display)
        return Array.from(messageMap.values()).sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? 0;
            const bTime = b.createdAt?.toMillis?.() ?? 0;
            return bTime - aTime;
        });
    }, [realtimeMessages, olderMessages]);

    // Listen to user's chats
    useEffect(() => {
        if (!user) {
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
                        text: "Let's meet tomorrow.",
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
            where('participants', 'array-contains', user.id),
            orderBy('updatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            chatsQuery,
            (snapshot) => {
                const chatsData = snapshot.docs.map((doc) => doc.data());

                const sortedChats = chatsData.sort((a, b) => {
                    const getMostRecentTimestamp = (chat: typeof a): number => {
                        if (chat.lastMessage?.timestamp) {
                            return chat.lastMessage.timestamp.toMillis();
                        }
                        if (chat.updatedAt) {
                            return chat.updatedAt.toMillis();
                        }
                        if (chat.createdAt) {
                            return chat.createdAt.toMillis();
                        }
                        return 0;
                    };

                    const aTimestamp = getMostRecentTimestamp(a);
                    const bTimestamp = getMostRecentTimestamp(b);

                    return bTimestamp - aTimestamp;
                });

                setChats(sortedChats);
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

    // Listen to current chat messages (realtime — most recent batch)
    useEffect(() => {
        if (!currentChat) {
            setRealtimeMessages(null);
            setOlderMessages([]);
            setHasMoreMessages(true);
            setOldestDocSnapshot(null);
            return;
        }

        // Reset pagination state on chat change
        setOlderMessages([]);
        setHasMoreMessages(true);
        setOldestDocSnapshot(null);

        const messagesQuery = query(
            chatMessagesCollection(currentChat.id),
            orderBy('createdAt', 'desc'),
            limit(MESSAGES_PER_PAGE)
        );

        const unsubscribe = onSnapshot(
            messagesQuery,
            (snapshot) => {
                const messagesData = snapshot.docs.map((doc) => doc.data());
                setRealtimeMessages(messagesData);

                // Store the oldest doc snapshot as cursor for pagination (only on first load)
                if (snapshot.docs.length > 0) {
                    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
                    setOldestDocSnapshot((prev) => prev ?? lastDoc);
                }

                // If we got fewer than the limit, there are no more messages
                if (snapshot.docs.length < MESSAGES_PER_PAGE) {
                    setHasMoreMessages(false);
                }
            },
            (error) => {
                setError(error as Error);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [currentChat]);

    const loadOlderMessages = useCallback(async (): Promise<void> => {
        if (!currentChat || !hasMoreMessages || loadingOlderMessages || !oldestDocSnapshot) return;

        setLoadingOlderMessages(true);

        try {
            const olderQuery = query(
                chatMessagesCollection(currentChat.id),
                orderBy('createdAt', 'desc'),
                startAfter(oldestDocSnapshot),
                limit(MESSAGES_PER_PAGE)
            );

            const snapshot = await getDocs(olderQuery);
            const olderData = snapshot.docs.map((doc) => doc.data());

            if (olderData.length > 0) {
                setOlderMessages((prev) => [...prev, ...olderData]);
                setOldestDocSnapshot(snapshot.docs[snapshot.docs.length - 1]);
            }

            if (olderData.length < MESSAGES_PER_PAGE) {
                setHasMoreMessages(false);
            }
        } catch (error) {
            console.error('Error loading older messages:', error);
            setError(error as Error);
        }

        setLoadingOlderMessages(false);
    }, [currentChat, hasMoreMessages, loadingOlderMessages, oldestDocSnapshot]);

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
        hasMoreMessages,
        loadingOlderMessages,
        setCurrentChat,
        createNewChat,
        sendNewMessage,
        markAsRead,
        addParticipant,
        removeParticipant,
        loadOlderMessages
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
