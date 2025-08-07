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
import { doc, getDoc, Timestamp, collection, getDocs, query, where, limit } from 'firebase/firestore';
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
        loading,
        createNewChat,
        setCurrentChat,
        addParticipant
    } = useChat();
    const { user } = useAuth();
    const [messageText, setMessageText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [otherUser, setOtherUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [groupName, setGroupName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [allUsersData, setAllUsersData] = useState<User[]>([]);
    const [participantData, setParticipantData] = useState<Record<string, User>>({});
    const [isAddingMembers, setIsAddingMembers] = useState(false);

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

    // Fetch current chat participants data
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

    // Search users function
    const searchUsers = async (query: string): Promise<void> => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // Query Firestore for users - using a simpler approach
            const usersRef = collection(db, 'users');
            const usersSnapshot = await getDocs(usersRef);
            
            // Filter users based on search query
            const allUsers = usersSnapshot.docs.map(doc => {
                const userData = doc.data() as User;
                return { ...userData, id: doc.id };
            });

            // Filter by search query and exclude current user, already selected users, and existing chat participants
            const availableUsers = allUsers
                .filter(userData => 
                    userData.id !== user?.id && // Exclude current user
                    !selectedUsers.some(selected => selected.id === userData.id) && // Exclude already selected
                    !currentChat?.participants.includes(userData.id) && // Exclude existing chat participants
                    (userData.name?.toLowerCase().includes(query.toLowerCase()) ||
                     userData.username?.toLowerCase().includes(query.toLowerCase()) ||
                     userData.bio?.toLowerCase().includes(query.toLowerCase()))
                )
                .slice(0, 5);

            setSearchResults(availableUsers);
        } catch (error) {
            console.error('Error searching users:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Debounced search effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            void searchUsers(searchQuery);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, selectedUsers]);

    // Show selected users first, then search results
    const displayUsers = [
        ...selectedUsers,
        ...searchResults
    ];

    const toggleUserSelection = (user: User) => {
        if (selectedUsers.some((u) => u.id === user.id)) {
            setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
        } else {
            setSelectedUsers([...selectedUsers, user]);
        }
    };

    const handleAddSelectedMembers = async () => {
        if (!currentChat && !newChat) return;
        
        if (newChat) {
            if (selectedUsers.length === 0) {
                return; // Just return without alert
            }

            try {
                setIsAddingMembers(true);
                console.log('Creating chat with selected users:', selectedUsers);
                
                // Determine if this should be a direct or group chat
                const isGroupChat = selectedUsers.length > 1;
                const chatType = isGroupChat ? 'group' : 'direct';
                
                // Get all participant IDs (including current user)
                const participantIds = [
                    user.id,
                    ...selectedUsers.map(u => u.id)
                ];

                console.log('Participant IDs:', participantIds);
                console.log('Chat type:', chatType);

                let chatName: string | undefined;
                if (isGroupChat) {
                    // For group chats, use the custom name or create from selected users
                    chatName = groupName.trim() || selectedUsers
                        .map(u => u.name || u.username)
                        .join(', ');
                }

                console.log('Chat name:', chatName);

                // Create the new chat
                const chatId = await createNewChat(
                    chatType,
                    participantIds,
                    chatName
                );

                console.log('Chat created with ID:', chatId);

                // Set the new chat as current
                setCurrentChat({
                    id: chatId,
                    type: chatType,
                    participants: participantIds,
                    name: chatName,
                    owner: isGroupChat ? user.id : undefined,
                    admins: isGroupChat ? [user.id] : undefined,
                    createdAt: Timestamp.fromDate(new Date()),
                    updatedAt: Timestamp.fromDate(new Date())
                });

                // Close modal and reset state
                setSelectedUsers([]);
                setGroupName('');
                setSearchQuery('');
                setSearchResults([]);
                
                // Ensure modal closes with a small delay to allow UI updates
                setTimeout(() => {
                    onClose();
                }, 200);
            } catch (error) {
                console.error('Error creating chat:', error);
                console.error('Error details:', {
                    message: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined
                });
                // Don't show alert, just log the error
            } finally {
                setIsAddingMembers(false);
            }
        } else {
            // Add members to existing chat
            try {
                setIsAddingMembers(true);
                
                // Add all selected users
                for (const selectedUser of selectedUsers) {
                    await addParticipant(selectedUser.id);
                }
                
                // Immediately update the current chat participants in the UI
                if (currentChat) {
                    const updatedParticipants = [
                        ...currentChat.participants,
                        ...selectedUsers.map(u => u.id)
                    ];
                    
                    // Update the current chat object immediately for UI feedback
                    const updatedChat = {
                        ...currentChat,
                        participants: updatedParticipants
                    };
                    
                    // Force a re-render by updating the chat context
                    setCurrentChat(updatedChat);
                }
                
                // Close modal and reset state
                setSelectedUsers([]);
                setGroupName('');
                setSearchQuery('');
                setSearchResults([]);
                
                // Ensure modal closes with a small delay to allow UI updates
                setTimeout(() => {
                    onClose();
                }, 200);
            } catch (error) {
                console.error('Error adding participants:', error);
                // Don't show alert, just log the error
            } finally {
                setIsAddingMembers(false);
            }
        }
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
                        {newChat ? 'Create New Chat' : 'Members'}
                        <XMarkIcon
                            className='h-6 w-6 cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            onClick={onClose}
                        />
                    </Dialog.Title>
                    {newChat && selectedUsers.length > 1 && (
                        <div className='mt-4'>
                            <input
                                type='text'
                                placeholder='Enter group name (optional)'
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className='w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-white dark:border-gray-700'
                            />
                        </div>
                    )}
                    {!newChat && currentChat && (
                        <div className='mb-4'>
                            <h3 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                                Current Members ({currentChat.participants.length})
                            </h3>
                            <div className='space-y-2 max-h-32 overflow-y-auto'>
                                {currentChat.participants.map((participantId) => {
                                    const participant = participantData[participantId];
                                    return (
                                        <div key={participantId} className='flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg'>
                                            <div className='relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
                                                {participant?.photoURL ? (
                                                    <Image
                                                        src={participant.photoURL}
                                                        alt={participant.name || participant.username || 'User'}
                                                        width={32}
                                                        height={32}
                                                        className='object-cover'
                                                    />
                                                ) : (
                                                    <UserIcon className='h-4 w-4 text-gray-500 dark:text-gray-400' />
                                                )}
                                            </div>
                                            <div className='flex flex-col'>
                                                <span className='text-sm font-medium text-gray-900 dark:text-white'>
                                                    {participant?.name || participant?.username || 'Unknown User'}
                                                </span>
                                                <span className='text-xs text-gray-500 dark:text-gray-400'>
                                                    {participant?.username || participantId}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className='mt-4'>
                        <input
                            type='text'
                            placeholder={newChat ? 'Search users to add to chat...' : 'Search users to add...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className='w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-white dark:border-gray-700'
                        />
                    </div>
                    <div className='mt-4 max-h-80 overflow-y-auto'>
                        {isSearching && (
                            <p className='text-sm text-gray-500 dark:text-gray-400'>
                                Searching...
                            </p>
                        )}
                        {!isSearching && displayUsers.length === 0 && searchQuery && (
                            <p className='text-sm text-gray-500 dark:text-gray-400'>
                                No users found.
                            </p>
                        )}
                        {!isSearching && displayUsers.length === 0 && !searchQuery && (
                            <p className='text-sm text-gray-500 dark:text-gray-400'>
                                Start typing to search for users.
                            </p>
                        )}
                        {displayUsers.map((userItem) => {
                            const isSelected = selectedUsers.some(u => u.id === userItem.id);
                            const isSelectedUser = selectedUsers.some(u => u.id === userItem.id);
                            const isExistingMember = currentChat?.participants.includes(userItem.id);
                            
                            return (
                                <label
                                    key={userItem.id}
                                    className={`flex items-center justify-between gap-3 mb-2 pr-2 cursor-pointer ${
                                        isSelectedUser ? 'bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2' : ''
                                    } ${isExistingMember ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className='flex items-center gap-3 cursor-pointer'>
                                        <div className='relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
                                            {userItem.photoURL ? (
                                                <Image
                                                    src={userItem.photoURL}
                                                    alt={
                                                        userItem.name ||
                                                        userItem.username ||
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
                                        <div className='flex flex-col'>
                                            <span className='text-gray-900 dark:text-white font-medium'>
                                                {userItem.name || userItem.username || 'Unknown User'}
                                            </span>
                                            <span className='text-xs text-gray-500 dark:text-gray-400'>
                                                @{userItem.username || userItem.id}
                                            </span>
                                            {isSelectedUser && (
                                                <span className='text-xs text-blue-600 dark:text-blue-400 font-medium'>
                                                    ✓ Selected
                                                </span>
                                            )}
                                            {isExistingMember && (
                                                <span className='text-xs text-gray-500 dark:text-gray-400'>
                                                    Already in group
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <input
                                        type='checkbox'
                                        checked={isSelected}
                                        onChange={() => !isExistingMember && toggleUserSelection(userItem)}
                                        disabled={isExistingMember}
                                        className='form-checkbox h-4 w-4 text-main-accent disabled:opacity-50'
                                    />
                                </label>
                            );
                        })}
                    </div>
                    {selectedUsers.length > 0 && (
                        <div className='mt-4'>
                            <button
                                type='button'
                                disabled={isAddingMembers}
                                className='w-full px-4 py-2 bg-main-accent text-white rounded hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed'
                                onClick={handleAddSelectedMembers}
                            >
                                {isAddingMembers 
                                    ? 'Adding...' 
                                    : newChat
                                        ? selectedUsers.length > 1
                                            ? 'Make Group'
                                            : 'Send Message'
                                        : 'Add Selected Members'
                                }
                            </button>
                        </div>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
