import { useEffect, useRef, useState } from 'react';
import { useChat } from '@lib/context/chat-context';
import { useAuth } from '@lib/context/auth-context';
import { formatDistanceToNow } from 'date-fns';
import type { Message } from '@lib/types/message';
import { UserIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@lib/firebase/app';
import type { User } from '@lib/types/user';
import { Loading } from '@components/ui/loading';

function MessageItem({
    message,
    isOwnMessage,
    showTime = true
}: {
    message: Message;
    isOwnMessage: boolean;
    showTime?: boolean;
}): JSX.Element {
    return (
        <div
            className={`flex w-full ${
                isOwnMessage ? 'justify-end' : 'justify-start'
            }`}
        >
            <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isOwnMessage
                        ? 'bg-[#333399] text-white'
                        : 'bg-[#6600ff] text-white'
                }`}
            >
                <p className='break-words'>{message.text}</p>
                {showTime && message.createdAt?.toDate && (
                    <p
                        className={`mt-1 text-xs ${
                            isOwnMessage ? 'text-white/70' : 'text-white/70'
                        }`}
                    >
                        {formatDistanceToNow(message.createdAt.toDate(), {
                            addSuffix: true
                        })}
                    </p>
                )}
            </div>
        </div>
    );
}

export function ChatWindow(): JSX.Element {
    const { currentChat, messages, sendNewMessage, markAsRead, loading } =
        useChat();
    const { user } = useAuth();
    const [messageText, setMessageText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [otherUser, setOtherUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);

   

    const otherParticipant = currentChat?.participants.find(
        (p) => p !== user?.id
    );

    useEffect(() => {
        if (!otherParticipant) {
            return;
        }

        const fetchUserData = async (): Promise<void> => {
            try {
                const userDoc = await getDoc(
                    doc(db, 'users', otherParticipant)
                );
                if (userDoc.exists()) {
                    setOtherUser(userDoc.data() as User);
                } else {
                }
            } catch (error) {
            }
        };

        void fetchUserData();
    }, [otherParticipant]);

    useEffect(() => {
        if (currentChat) {
            setIsLoading(true);
            // Simulate loading time for messages
            const timer = setTimeout(() => {
                setIsLoading(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentChat]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        if (!currentChat || !user) {
            return;
        }

        const unreadMessages = messages?.filter(
            (message) =>
                message.senderId !== user.id &&
                !message.readBy.includes(user.id)
        );


        if (unreadMessages?.length) {
            void Promise.all(
                unreadMessages.map((message) => markAsRead(message.id))
            );
        }
    }, [currentChat, messages, user, markAsRead]);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!messageText.trim()) return;

        try {
            await sendNewMessage(messageText);
            setMessageText('');
        } catch (error) {
        }
    };

    return (
        <div className='flex h-full flex-col'>
            {currentChat ? (
                <>
                    <div className='flex items-center gap-3 border-b border-gray-200 p-4 dark:border-gray-800'>
                        <div className='relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
                            {otherUser?.photoURL ? (
                                <Image
                                    src={otherUser.photoURL}
                                    alt={
                                        otherUser.name ||
                                        otherUser.username ||
                                        'User'
                                    }
                                    width={40}
                                    height={40}
                                    className='object-cover'
                                />
                            ) : (
                                <UserIcon className='h-6 w-6' />
                            )}
                        </div>
                        <div>
                            <p className='font-medium'>
                                {currentChat.type === 'direct'
                                    ? otherUser?.name ||
                                      otherUser?.username ||
                                      otherParticipant
                                    : currentChat.name}
                            </p>
                            <p className='text-sm text-gray-500 dark:text-gray-400'>
                                {currentChat.type === 'direct'
                                    ? 'Direct Message'
                                    : `${currentChat.participants.length} participants`}
                            </p>
                        </div>
                    </div>
                    <div className='flex-1 overflow-y-auto p-4'>
                        {isLoading ? (
                            <div className='flex h-full w-full items-center justify-center'>
                                <Loading className='h-8 w-8' />
                            </div>
                        ) : messages?.length ? (
                            <div className='flex flex-col gap-2'>
                                {[...messages]
                                    .reverse()
                                    .map((message, index, reversedMessages) => {
                                        const isOwnMessage =
                                            message.senderId === user?.id;
                                        const nextMessage =
                                            reversedMessages[index + 1];
                                        const showTime =
                                            !nextMessage ||
                                            nextMessage.senderId !==
                                                message.senderId;

                                        return (
                                            <MessageItem
                                                key={message.id}
                                                message={message}
                                                isOwnMessage={isOwnMessage}
                                                showTime={showTime}
                                            />
                                        );
                                    })}
                                <div ref={messagesEndRef} />
                            </div>
                        ) : (
                            <div className='flex h-full items-center justify-center'>
                                <p className='text-gray-500 dark:text-gray-400'>
                                    No messages yet
                                </p>
                            </div>
                        )}
                    </div>
                    <div className='border-t border-gray-200 p-4 dark:border-gray-800'>
                        <form
                            onSubmit={handleSubmit}
                            className='flex items-center gap-2'
                        >
                            <input
                                type='text'
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                placeholder='Type a message...'
                                className='flex-1 rounded-full border border-gray-200 bg-gray-100 px-4 py-2 outline-none transition-colors focus:border-primary dark:border-gray-800 dark:bg-gray-900 dark:focus:border-primary'
                            />
                            <button
                                type='submit'
                                disabled={!messageText.trim()}
                                className='rounded-full bg-primary p-2 text-white transition-colors hover:bg-primary/90 disabled:opacity-50'
                            >
                                <PaperAirplaneIcon className='h-5 w-5' />
                            </button>
                        </form>
                    </div>
                </>
            ) : (
                <div className='flex h-full items-center justify-center'>
                    <p className='text-gray-500 dark:text-gray-400'>
                        Select a chat to start messaging
                    </p>
                </div>
            )}
        </div>
    );
}
