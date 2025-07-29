import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@lib/firebase/app';
import { ChatContextProvider } from '@lib/context/chat-context';
import { useChat } from '@lib/context/chat-context';
import { Chat } from '@components/chat/chat';
import { Loading } from '@components/ui/loading';
import { MainLayout } from '@components/layout/main-layout';
import { ProtectedLayout } from '@components/layout/common-layout';
import type { Chat as ChatType } from '@lib/types/chat';
import type { ReactElement, ReactNode } from 'react';

function ChatPageContent(): JSX.Element {
    const { query, push } = useRouter();
    const { setCurrentChat, currentChat, loading } = useChat();
    const chatId = query.chatId as string;

    useEffect(() => {
        if (!chatId) return;

        const fetchChat = async (): Promise<void> => {
            try {
                const chatDoc = await getDoc(doc(db, 'chats', chatId));
                if (chatDoc.exists()) {
                    const chatData = chatDoc.data() as Omit<ChatType, 'id'>;
                    setCurrentChat({ id: chatDoc.id, ...chatData });
                } else await push('/chat');
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error fetching chat:', error);
                await push('/chat');
            }
        };

        void fetchChat();
    }, [chatId, setCurrentChat, push]);

    // If we're loading the chat list, show loading
    if (loading) return <Loading className='mt-5' />;

    // If we have a chat ID but no current chat yet, show loading
    if (chatId && !currentChat) return <Loading className='mt-5' />;

    // If we have a current chat or no chat ID, show the chat component
    return <Chat />;
}

export default function ChatPage(): JSX.Element {
    return (
        <ChatContextProvider>
            <ChatPageContent />
        </ChatContextProvider>
    );
}

ChatPage.getLayout = (page: ReactElement): ReactNode => (
    <ProtectedLayout>
        <MainLayout>{page}</MainLayout>
    </ProtectedLayout>
);
