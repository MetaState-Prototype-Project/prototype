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
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@lib/firebase/app';
import type { User } from '@lib/types/user';
import { Loading } from '@components/ui/loading';
import { Dialog } from '@headlessui/react';

export function AddMembers({
    open,
    onClose,
    newChat = false
}: {
    open: boolean;
    onClose: () => void;
    newChat?: boolean;
}): JSX.Element {
    const {
        currentChat,
        messages,
        sendNewMessage,
        markAsRead,
        removeParticipant,
        loading
    } = useChat();
    const { user } = useAuth();
    const [messageText, setMessageText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [otherUser, setOtherUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

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

    useEffect(() => {
        // Fetch all users on platform for selection
        const fetchAllUsers = async (): Promise<void> => {
            try {
                // Assuming a collection 'users' in Firestore
                const usersSnapshot = await db.collection('users').get();
                const usersData: User[] = usersSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...(doc.data() as User)
                }));
                setAllUsers(usersData);
            } catch (error) {
                // handle error if needed
                // TODO: Dummy users for development, remove when backend integrated
                setAllUsers([
                    {
                        id: 'user_5',
                        name: 'Alice Sharma',
                        username: 'alice.s',
                        bio: 'Techie and Coffee Lover',
                        theme: 'dark',
                        accent: 'blue',
                        website: 'https://alicesharma.dev',
                        location: 'Delhi, India',
                        photoURL: 'https://i.pravatar.cc/150?img=1',
                        verified: true,
                        following: [],
                        followers: [],
                        createdAt: Timestamp.fromDate(new Date()),
                        updatedAt: Timestamp.fromDate(new Date()),
                        totalTweets: 50,
                        totalPhotos: 5,
                        pinnedTweet: '',
                        coverPhotoURL:
                            'https://source.unsplash.com/random/800x200?tech'
                    },
                    {
                        id: 'user_6',
                        name: 'Rahul Verma',
                        username: 'rahulv',
                        bio: 'Frontend Wizard 🧙‍♂️',
                        theme: 'light',
                        accent: 'green',
                        website: 'https://rahulv.dev',
                        location: 'Bangalore, India',
                        photoURL: 'https://i.pravatar.cc/150?img=2',
                        verified: false,
                        following: [],
                        followers: [],
                        createdAt: Timestamp.fromDate(new Date()),
                        updatedAt: Timestamp.fromDate(new Date()),
                        totalTweets: 120,
                        totalPhotos: 20,
                        pinnedTweet: '',
                        coverPhotoURL:
                            'https://source.unsplash.com/random/800x200?frontend'
                    },
                    {
                        id: 'user_7',
                        name: 'Nisha Kapoor',
                        username: 'nishak',
                        bio: 'UI/UX Designer 🎨',
                        theme: 'dark',
                        accent: 'purple',
                        website: '',
                        location: 'Mumbai, India',
                        photoURL: 'https://i.pravatar.cc/150?img=3',
                        verified: true,
                        following: [],
                        followers: [],
                        createdAt: Timestamp.fromDate(new Date()),
                        updatedAt: Timestamp.fromDate(new Date()),
                        totalTweets: 300,
                        totalPhotos: 45,
                        pinnedTweet: '',
                        coverPhotoURL:
                            'https://source.unsplash.com/random/800x200?design'
                    }
                ]);
            }
        };
        void fetchAllUsers();
    }, []);

    const filteredUsers = allUsers.filter(
        (u) => newChat || !currentChat?.participants.includes(u.id)
    );

    const toggleUserSelection = (user: User) => {
        if (selectedUsers.some((u) => u.id === user.id)) {
            setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
        } else {
            setSelectedUsers([...selectedUsers, user]);
        }
    };

    const handleAddSelectedMembers = async () => {
        if (!currentChat && !newChat) return;
        // Replace this with actual logic to update Firestore group chat participants
        if (newChat) {
            // alert(
            //     `Creating new chat with: ${[...selectedUsers, user as User]
            //         .map((u) => u.name || u.username)
            //         .join(', ')}`
            // );
            alert(
                `Creating new chat with: ${selectedUsers
                    .map((u) => u.name || u.username)
                    .join(', ')}`
            );
        } else {
            alert(
                `Added: ${selectedUsers
                    .map((u) => u.name || u.username)
                    .join(', ')}`
            );
        }
        setSelectedUsers([]);
        onClose();
    };

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
                    <div className='mt-4'>
                        <input
                            type='text'
                            placeholder='Search users...'
                            className='w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-white dark:border-gray-700'
                        />
                    </div>
                    <div className='mt-4 max-h-80 overflow-y-auto'>
                        {filteredUsers.length === 0 && (
                            <p className='text-sm text-gray-500 dark:text-gray-400'>
                                No users available to add.
                            </p>
                        )}
                        {filteredUsers.map((userItem) => (
                            <label
                                key={userItem.id}
                                className='flex items-center justify-between gap-3 mb-2 pr-2 cursor-pointer'
                            >
                                <div className='flex items-center gap-3 mb-2 cursor-pointer'>
                                    <div className='relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
                                        {userItem.photoURL ? (
                                            <Image
                                                src={userItem.photoURL}
                                                alt={
                                                    userItem.name ||
                                                    userItem.username ||
                                                    'User'
                                                }
                                                width={32}
                                                height={32}
                                                className='object-cover'
                                            />
                                        ) : (
                                            <UserIcon className='h-5 w-5 text-gray-500 dark:text-gray-400' />
                                        )}
                                    </div>
                                    <span className='text-gray-900 dark:text-white'>
                                        {userItem.name ||
                                            userItem.username ||
                                            userItem.id}
                                    </span>
                                </div>
                                <input
                                    type='checkbox'
                                    checked={selectedUsers.some(
                                        (u) => u.id === userItem.id
                                    )}
                                    onChange={() =>
                                        toggleUserSelection(userItem)
                                    }
                                    className='form-checkbox h-4 w-4 text-main-accent'
                                />
                            </label>
                        ))}
                    </div>
                    {selectedUsers.length > 0 && (
                        <div className='mt-4'>
                            <button
                                type='button'
                                className='w-full px-4 py-2 bg-main-accent text-white rounded hover:brightness-90'
                                onClick={handleAddSelectedMembers}
                            >
                                {newChat
                                    ? selectedUsers.length > 1
                                        ? 'Make Group'
                                        : 'Send Message'
                                    : 'Add Selected Members'}
                            </button>
                        </div>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
