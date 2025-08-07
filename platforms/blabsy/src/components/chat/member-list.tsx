import { useEffect, useRef, useState } from 'react';
import { useChat } from '@lib/context/chat-context';
import { useAuth } from '@lib/context/auth-context';
import {
    UserIcon,
    PaperAirplaneIcon,
    EllipsisVerticalIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@lib/firebase/app';
import type { User } from '@lib/types/user';
import { Loading } from '@components/ui/loading';
import { Dialog } from '@headlessui/react';
import { CrownIcon, ShieldIcon } from '@sidekickicons/react/24/outline';

export function MemberList({
    open,
    onClose,
    onOpenAddMemberModal
}: {
    open: boolean;
    onClose: () => void;
    onOpenAddMemberModal: () => void;
}): JSX.Element {
    const {
        currentChat,
        messages,
        sendNewMessage,
        markAsRead,
        removeParticipant,
        loading,
        setCurrentChat
    } = useChat();
    const { user } = useAuth();
    const [messageText, setMessageText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [otherUser, setOtherUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [participantData, setParticipantData] = useState<Record<string, User>>({});
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);

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
            } catch (error) {}
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

    // Fetch all participants data
    useEffect(() => {
        if (!currentChat?.participants) return;

        const fetchParticipantData = async (): Promise<void> => {
            try {
                const newParticipantData: Record<string, User> = {};
                
                for (const participantId of currentChat.participants) {
                    if (participantId === user?.id) {
                        // Use current user data
                        if (user) {
                            newParticipantData[participantId] = user;
                        }
                    } else {
                        // Fetch other participants' data
                        const userDoc = await getDoc(doc(db, 'users', participantId));
                        if (userDoc.exists()) {
                            newParticipantData[participantId] = userDoc.data() as User;
                        }
                    }
                }
                
                setParticipantData(newParticipantData);
            } catch (error) {
                console.error('Error fetching participants data:', error);
            }
        };

        void fetchParticipantData();
    }, [currentChat, user]);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!messageText.trim()) return;

        try {
            await sendNewMessage(messageText);
            setMessageText('');
        } catch (error) {}
    };

    return (
        <Dialog open={open} onClose={onClose} className='relative z-10'>
            <div className='fixed inset-0 bg-black/30' aria-hidden='true' />
            <div className='fixed inset-0 flex items-center justify-center p-4'>
                <Dialog.Panel className='w-full max-w-md transform overflow-visible rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-900'>
                    <Dialog.Title className='flex items-center justify-between text-lg font-medium leading-6 text-gray-900 dark:text-white'>
                        Members
                        <XMarkIcon
                            className='h-6 w-6 cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            onClick={onClose}
                        />
                    </Dialog.Title>
                    <div className='mt-4 flex flex-col gap-2'>
                        {currentChat?.participants.map((participantId) => (
                            <div
                                key={participantId}
                                className='flex items-center justify-between gap-3 border-b border-gray-200 pb-2 mb-2 dark:border-gray-800'
                            >
                                <div className='flex items-center gap-3'>
                                    <div className='relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
                                        {participantData[participantId]?.photoURL ? (
                                            <Image
                                                src={participantData[participantId].photoURL}
                                                alt={
                                                    participantData[participantId].name ||
                                                    participantData[participantId].username ||
                                                    'User'
                                                }
                                                width={40}
                                                height={40}
                                                className='object-cover'
                                            />
                                        ) : (
                                            <UserIcon className='h-6 w-6 text-gray-500 dark:text-gray-400' />
                                        )}
                                    </div>
                                    <div>
                                        <p className='flex items-center gap-1 font-medium text-gray-900 dark:text-white'>
                                            {participantData[participantId]?.name || 
                                             participantData[participantId]?.username || 
                                             'Unknown User'}
                                            {currentChat.owner === participantId && (
                                                <CrownIcon className='inline h-6 w-6 text-yellow-500 ml-1' />
                                            )}
                                            {currentChat.admins?.includes(participantId) && (
                                                <ShieldIcon className='inline h-5 w-5 text-yellow-600 ml-1' />
                                            )}
                                        </p>
                                        <p className='text-sm text-gray-500 dark:text-gray-400'>
                                            {participantData[participantId]?.username && (
                                                <span>@{participantData[participantId].username}</span>
                                            )}
                                            {currentChat.owner === participantId && (
                                                <span className='ml-2 text-yellow-600 dark:text-yellow-400'>Owner</span>
                                            )}
                                            {currentChat.admins?.includes(participantId) && currentChat.owner !== participantId && (
                                                <span className='ml-2 text-blue-600 dark:text-blue-400'>Admin</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                {((user &&
                                    currentChat?.admins?.includes(user?.id)) ||
                                    currentChat?.owner === user?.id) &&
                                    currentChat.owner !== participantId && (
                                        <div className='relative'>
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    setOpenMenuId((prev) =>
                                                        prev === participantId
                                                            ? null
                                                            : participantId
                                                    )
                                                }
                                                className='p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 group'
                                            >
                                                <EllipsisVerticalIcon className='h-5 w-5 text-gray-600 dark:text-gray-300' />
                                            </button>
                                            {openMenuId === participantId && (
                                                <div className='absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-md z-50'>
                                                    <button
                                                        type='button'
                                                        disabled={removingUserId === participantId}
                                                        onClick={async () => {
                                                            try {
                                                                setRemovingUserId(participantId);
                                                                await removeParticipant(participantId);
                                                                
                                                                // Immediately update the current chat participants in the UI
                                                                if (currentChat) {
                                                                    const updatedParticipants = currentChat.participants.filter(
                                                                        id => id !== participantId
                                                                    );
                                                                    
                                                                    // Update the current chat object immediately for UI feedback
                                                                    const updatedChat = {
                                                                        ...currentChat,
                                                                        participants: updatedParticipants
                                                                    };
                                                                    
                                                                    // Force a re-render by updating the chat context
                                                                    setCurrentChat(updatedChat);
                                                                }
                                                                
                                                                setOpenMenuId(null);
                                                            } catch (error) {
                                                                console.error('Failed to remove member:', error);
                                                                // Could add a toast notification here
                                                            } finally {
                                                                setRemovingUserId(null);
                                                            }
                                                        }}
                                                        className='block w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
                                                    >
                                                        {removingUserId === participantId ? 'Removing...' : 'Remove Member'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                            </div>
                        ))}
                    </div>
                    {((user && currentChat?.admins?.includes(user?.id)) ||
                        currentChat?.owner === user?.id) && (
                        <div className='flex justify-center gap-2 mt-4'>
                            <button
                                type='button'
                                onClick={onOpenAddMemberModal}
                                className='px-4 py-2 text-sm rounded-md bg-main-accent text-white hover:brightness-90'
                            >
                                Add Member
                            </button>
                        </div>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
