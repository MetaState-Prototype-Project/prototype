import { useEffect, useRef, useState } from 'react';
import { useChat } from '@lib/context/chat-context';
import { useAuth } from '@lib/context/auth-context';
import { formatDistanceToNow, set } from 'date-fns';
import type { Message } from '@lib/types/message';
import { getChatType } from '@lib/types/chat';
import {
    UserIcon,
    PaperAirplaneIcon,
    Cog6ToothIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@lib/firebase/app';
import { Loading } from '@components/ui/loading';
import { MemberList } from './member-list';
import { GroupSettings } from './group-settings';
import { AddMembers } from './add-members';
import { User } from '@lib/types/user';

function MessageItem({
    message,
    isOwnMessage,
    showTime = true,
    showUserInfo = false,
    userData = null
}: {
    message: Message;
    isOwnMessage: boolean;
    showTime?: boolean;
    showUserInfo?: boolean;
    userData?: User | null;
}): JSX.Element {
    // Check if this is a system message
    const isSystemMessage = !message.senderId || message.text.startsWith('$$system-message$$');
    // Remove the prefix for display
    const displayText = isSystemMessage && message.text.startsWith('$$system-message$$') 
        ? message.text.replace('$$system-message$$', '').trim() 
        : message.text;



        if (isSystemMessage) {
        return (
            <div className="flex w-full justify-center my-4">
                <div className="max-w-[80%] text-center">
                    <div className="inline-block rounded-[10px] bg-gray-100 dark:bg-gray-800 px-4 py-2">
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-pre-wrap text-left">
                            <div dangerouslySetInnerHTML={{ __html: displayText.replace(/<a href="([^"]+)">([^<]+)<\/a>/g, '<a href="$1" class="text-blue-600 hover:text-blue-800 underline">$2</a>') }} />
                        </div>
                    </div>
                    {showTime && message.createdAt?.toDate && (
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            {formatDistanceToNow(message.createdAt.toDate(), {
                                addSuffix: true
                            })}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex w-full ${
                isOwnMessage ? 'justify-end' : 'justify-start'
            }`}
        >
            <div
                className={`flex max-w-[70%] ${
                    isOwnMessage ? 'flex-col items-end' : 'flex-col items-start'
                } gap-1`}
            >
                {/* User Avatar and Name - Above the message */}
                {!isOwnMessage && showUserInfo && (
                    <div className='flex items-center gap-2 mb-1'>
                        <div className='relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
                            {userData?.photoURL ? (
                                <Image
                                    src={userData.photoURL}
                                    alt={
                                        userData.name ||
                                        userData.username ||
                                        'User'
                                    }
                                    width={24}
                                    height={24}
                                    className='object-cover'
                                />
                            ) : (
                                <UserIcon className='h-4 w-4 text-gray-500 dark:text-gray-400' />
                            )}
                        </div>
                        <span className='text-xs text-gray-500 dark:text-gray-400 font-medium'>
                            {userData?.name || userData?.username || 'Unknown'}
                        </span>
                    </div>
                )}

                {/* Message Bubble */}
                <div
                    className={`rounded-2xl px-4 py-2 ${
                        isOwnMessage
                            ? 'bg-[#333399] text-white'
                            : 'bg-[#6600ff] text-white'
                    } ${!isOwnMessage ? 'ml-8' : ''}`}
                >
                    <div className='break-words whitespace-pre-wrap' dangerouslySetInnerHTML={{ __html: displayText.replace(/<a href="([^"]+)">([^<]+)<\/a>/g, '<a href="$1" class="text-blue-600 hover:text-blue-800 underline">$2</a>') }} />
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
    const [participantsData, setParticipantsData] = useState<
        Record<string, User>
    >({});
    const [isLoading, setIsLoading] = useState(false);
    const [openMemberList, setOpenMemberList] = useState(false);
    const [openEditMenu, setOpenEditMenu] = useState<boolean>(false);
    const [openAddMemberList, setOpenAddMemberList] = useState<boolean>(false);

    const otherParticipant = currentChat?.participants.find(
        (p) => p !== user?.id
    );

    useEffect(() => {
        if (!currentChat?.participants) return;

        const fetchParticipantsData = async (): Promise<void> => {
            try {
                const newParticipantsData: Record<string, User> = {};

                // Fetch data for all participants
                for (const participantId of currentChat.participants) {
                    if (participantId === user?.id) {
                        // Use current user data
                        if (user) {
                            newParticipantsData[participantId] = user;
                        }
                    } else {
                        // Fetch other participants' data
                        const userDoc = await getDoc(
                            doc(db, 'users', participantId)
                        );
                        if (userDoc.exists()) {
                            newParticipantsData[participantId] =
                                userDoc.data() as User;
                        }
                    }
                }

                setParticipantsData(newParticipantsData);

                // Set otherUser for direct chats
                if (getChatType(currentChat) === 'direct') {
                    const otherParticipant = currentChat.participants.find(
                        (p) => p !== user?.id
                    );
                    if (
                        otherParticipant &&
                        newParticipantsData[otherParticipant]
                    ) {
                        console.log('ChatWindow: Setting otherUser:', newParticipantsData[otherParticipant]);
                        setOtherUser(newParticipantsData[otherParticipant]);
                    } else {
                        console.log('ChatWindow: Could not set otherUser. otherParticipant:', otherParticipant, 'userData:', otherParticipant ? newParticipantsData[otherParticipant] : 'undefined');
                    }
                }
            } catch (error) {
                console.error('Error fetching participants data:', error);
            }
        };

        void fetchParticipantsData();
    }, [currentChat, user]);

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
        if (messagesEndRef.current)
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!currentChat || !user) return;

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
        } catch (error) {}
    };

    return (
        <div className='flex h-full flex-col'>
            {currentChat ? (
                <>
                    <div className='flex h-fit items-center justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-800'>
                        <div className='flex items-center gap-3'>
                            <div className='relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
                                {currentChat.type === 'group' ? (
                                    currentChat.photoURL ? (
                                        <Image
                                            src={currentChat.photoURL}
                                            alt={currentChat.name || 'Group'}
                                            width={40}
                                            height={40}
                                            className='object-cover'
                                        />
                                    ) : (
                                        <UserIcon className='h-6 w-6' />
                                    )
                                ) : otherUser?.photoURL ? (
                                    <Image
                                        src={otherUser.photoURL}
                                        alt={
                                            otherUser.name || otherUser.username || 'User'
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
                                    {getChatType(currentChat) === 'direct'
                                        ? otherUser?.name ||
                                          otherUser?.username ||
                                          otherParticipant
                                        : currentChat.name}
                                </p>
                                <p className='text-sm text-gray-500 dark:text-gray-400'>
                                    {currentChat.type === 'direct'
                                        ? otherUser?.username 
                                            ? `@${otherUser.username}`
                                            : 'Direct Message'
                                        : `${currentChat.participants.length} participants`}
                                </p>
                            </div>
                        </div>
                        {getChatType(currentChat) === 'group' && (
                            <div className='flex items-center gap-2'>
                                <div>
                                    <button
                                        type='button'
                                        onClick={() => setOpenMemberList(true)}
                                        className='flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800'
                                    >
                                        View Members
                                    </button>
                                </div>
                                <div>
                                    <button
                                        type='button'
                                        onClick={() => setOpenEditMenu(true)}
                                        className='rounded-full bg-primary p-2 text-white transition-colors hover:bg-primary/90'
                                    >
                                        <Cog6ToothIcon className='h-5 w-5' />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className='flex-1 p-4 overflow-y-auto'>
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
                                        const prevMessage =
                                            reversedMessages[index - 1];

                                        // Show time if next message is from different sender or doesn't exist
                                        const showTime =
                                            !nextMessage ||
                                            nextMessage.senderId !==
                                                message.senderId;

                                        // Show user info if:
                                        // 1. It's a group chat AND
                                        // 2. Previous message is from different sender OR doesn't exist OR
                                        // 3. Previous message is from same sender but more than 5 minutes ago
                                        const showUserInfo =
                                            getChatType(currentChat) === 'group' &&
                                            !isOwnMessage &&
                                            (!prevMessage ||
                                                prevMessage.senderId !==
                                                    message.senderId ||
                                                (prevMessage.createdAt
                                                    ?.toDate &&
                                                    message.createdAt?.toDate &&
                                                    Math.abs(
                                                        prevMessage.createdAt
                                                            .toDate()
                                                            .getTime() -
                                                            message.createdAt
                                                                .toDate()
                                                                .getTime()
                                                    ) >
                                                        5 * 60 * 1000));

                                        const userData =
                                            participantsData[message.senderId];

                                        return (
                                            <MessageItem
                                                key={message.id}
                                                message={message}
                                                isOwnMessage={isOwnMessage}
                                                showTime={showTime}
                                                showUserInfo={showUserInfo}
                                                userData={userData}
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
            <MemberList
                open={openMemberList}
                onClose={() => setOpenMemberList(false)}
                onOpenAddMemberModal={() => {
                    setOpenMemberList(false);
                    setOpenAddMemberList(true);
                }}
            />
            <AddMembers
                open={openAddMemberList}
                onClose={() => {
                    setOpenAddMemberList(false);
                    setOpenMemberList(true);
                }}
            />
            <GroupSettings
                open={openEditMenu}
                onClose={() => setOpenEditMenu(false)}
            />
        </div>
    );
}
