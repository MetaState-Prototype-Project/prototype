import { useState, useEffect, useContext, createContext, useMemo } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    limit
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
import type { Chat, Message } from '@lib/types/chat';

type ChatContext = {
    chats: Chat[] | null;
    currentChat: Chat | null;
    messages: Message[] | null;
    loading: boolean;
    error: Error | null;
    setCurrentChat: (chat: Chat | null) => void;
    createNewChat: (type: 'direct' | 'group', participants: string[], name?: string) => Promise<string>;
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
            console.log('No user, clearing chats');
            setChats(null);
            setLoading(false);
            return;
        }

        console.log('Setting up chat listener for user:', user.id);
        const chatsQuery = query(
            chatsCollection,
            where('participants', 'array-contains', user.id)
        );

        const unsubscribe = onSnapshot(
            chatsQuery,
            (snapshot) => {
                console.log('Chats snapshot received:', snapshot.docs.length, 'chats');
                const chatsData = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log('Processed chats data:', chatsData);
                setChats(chatsData);
                setLoading(false);
            },
            (error) => {
                console.error('Error in chat listener:', error);
                setError(error as Error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
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

        return () => unsubscribe();
    }, [currentChat]);

    const createNewChat = async (
        type: 'direct' | 'group',
        participants: string[],
        name?: string
    ): Promise<string> => {
        try {
            return await createChat(type, participants, name);
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