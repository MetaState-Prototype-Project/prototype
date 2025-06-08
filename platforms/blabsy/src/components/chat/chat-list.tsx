import { useChat } from '@lib/context/chat-context';
import { useAuth } from '@lib/context/auth-context';
import { formatDistanceToNow } from 'date-fns';
import type { Chat } from '@lib/types/chat';
import { Loading } from '@components/ui/loading';
import { UserIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@lib/firebase/app';
import { usersCollection } from '@lib/firebase/collections';
import type { User } from '@lib/types/user';
import Image from 'next/image';

type ParticipantData = {
    [key: string]: User;
};

export function ChatList(): JSX.Element {
    const { chats, currentChat, setCurrentChat, loading } = useChat();
    const { user } = useAuth();
    const [participantData, setParticipantData] = useState<ParticipantData>({});

    useEffect(() => {
        if (!chats || !user) return;

        const fetchParticipantData = async (): Promise<void> => {
            const newParticipantData: ParticipantData = {};
            
            for (const chat of chats) {
                const otherParticipantId = chat.participants.find(p => p !== user.id);
                if (otherParticipantId && !participantData[otherParticipantId]) {
                    const userDoc = await getDoc(doc(db, 'users', otherParticipantId));
                    if (userDoc.exists()) {
                        newParticipantData[otherParticipantId] = userDoc.data() as User;
                    }
                }
            }

            if (Object.keys(newParticipantData).length > 0) {
                setParticipantData(prev => ({ ...prev, ...newParticipantData }));
            }
        };

        void fetchParticipantData();
    }, [chats, user, participantData]);

   

    if (loading) {
        console.log('ChatList: Loading state');
        return <Loading className='mt-5' />;
    }

    if (!chats?.length) {
        console.log('ChatList: No chats found');
        return (
            <div className='flex h-full items-center justify-center'>
                <p className='text-gray-500 dark:text-gray-400'>
                    No chats yet
                </p>
            </div>
        );
    }

    return (
        <div className='flex h-full flex-col gap-2 overflow-y-auto p-4'>
            {chats.map((chat) => {
                const otherParticipant = chat.participants.find(
                    (p) => p !== user?.id
                );
                const participant = otherParticipant ? participantData[otherParticipant] : null;
                

                return (
                    <button
                        key={chat.id}
                        onClick={() => setCurrentChat(chat)}
                        className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                            currentChat?.id === chat.id
                                ? 'bg-primary text-white'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                        <div className='relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
                            {participant?.photoURL ? (
                                <Image
                                    src={participant.photoURL}
                                    alt={participant.name || participant.username || 'User'}
                                    width={40}
                                    height={40}
                                    className='object-cover'
                                />
                            ) : (
                                <UserIcon className='h-6 w-6' />
                            )}
                        </div>
                        <div className='flex-1 overflow-hidden text-left'>
                            <p className='truncate font-medium'>
                                {chat.type === 'direct'
                                    ? participant?.name || participant?.username || otherParticipant
                                    : chat.name}
                            </p>
                            {chat.lastMessage && (
                                <p className='truncate text-sm text-gray-500 dark:text-gray-400'>
                                    {chat.lastMessage.text}
                                </p>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

type ChatListItemProps = {
    chat: Chat;
    isSelected: boolean;
    currentUserId?: string;
    onClick: () => void;
};

function ChatListItem({
    chat,
    isSelected,
    currentUserId,
    onClick
}: ChatListItemProps): JSX.Element {
    const otherParticipants = chat.participants.filter(
        (id) => id !== currentUserId
    );

    return (
        <button
            className={`flex w-full items-center gap-3 rounded-lg p-3 transition hover:bg-gray-100 dark:hover:bg-gray-800 ${
                isSelected ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
            onClick={onClick}
        >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                {chat.type === 'group' ? (
                    <svg
                        className="h-6 w-6 text-gray-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                    </svg>
                ) : (
                    <svg
                        className="h-6 w-6 text-gray-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                    </svg>
                )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between">
                    <p className="truncate font-medium">
                        {chat.type === 'group'
                            ? chat.name
                            : `Chat with ${otherParticipants.length} users`}
                    </p>
                    {chat.lastMessage && (
                        <span className="text-xs text-gray-500">
                            {formatDistanceToNow(
                                chat.lastMessage.timestamp.toDate(),
                                { addSuffix: true }
                            )}
                        </span>
                    )}
                </div>
                {chat.lastMessage && (
                    <p className="truncate text-sm text-gray-500">
                        {chat.lastMessage.text}
                    </p>
                )}
            </div>
        </button>
    );
} 