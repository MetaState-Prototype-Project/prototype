import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { useChat } from '@lib/context/chat-context';
import { useAuth } from '@lib/context/auth-context';
import Image from 'next/image';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@lib/firebase/app';
import type { User } from '@lib/types/user';
import { Dialog } from '@headlessui/react';
import { UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@lib/firebase/app';

export function GroupSettings({
    open,
    onClose
}: {
    open: boolean;
    onClose: () => void;
}): JSX.Element {
    const { currentChat, setCurrentChat } = useChat();
    const { user } = useAuth();
    const [otherUser, setOtherUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [groupPhotoURL, setGroupPhotoURL] = useState<string | null>(null);
    const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const otherParticipant = currentChat?.participants.find(
        (p) => p !== user?.id
    );

    // Initialize form state when chat changes
    useEffect(() => {
        if (currentChat) {
            setGroupName(currentChat.name || '');
            setGroupDescription(currentChat.description || '');
            setGroupPhotoURL(currentChat.photoURL || null);
            setNewPhotoFile(null);
        }
    }, [currentChat]);

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

    const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setNewPhotoFile(file);
            // Create preview URL
            const previewURL = URL.createObjectURL(file);
            setGroupPhotoURL(previewURL);
        }
    };

    const uploadPhoto = async (file: File): Promise<string> => {
        const photoRef = ref(storage, `group-photos/${currentChat?.id}/${Date.now()}-${file.name}`);
        await uploadBytes(photoRef, file);
        return await getDownloadURL(photoRef);
    };

    const handleSave = async () => {
        if (!currentChat || !user) return;
        
        setIsSaving(true);
        try {
            let finalPhotoURL = groupPhotoURL;
            
            // Upload new photo if one was selected
            if (newPhotoFile) {
                finalPhotoURL = await uploadPhoto(newPhotoFile);
            }
            
            // Update the chat document
            const chatRef = doc(db, 'chats', currentChat.id);
            await updateDoc(chatRef, {
                name: groupName.trim() || null,
                description: groupDescription.trim() || null,
                photoURL: finalPhotoURL,
                updatedAt: serverTimestamp()
            });
            
            // Update the local chat context to reflect changes immediately
            const updatedChat = {
                ...currentChat,
                name: groupName.trim() || undefined,
                description: groupDescription.trim() || undefined,
                photoURL: finalPhotoURL || undefined
            };
            setCurrentChat(updatedChat);
            
            // Close the modal
            onClose();
        } catch (error) {
            console.error('Error updating group settings:', error);
            // You might want to show an error message to the user here
        } finally {
            setIsSaving(false);
        }
    };

    const isAdmin = user && (currentChat?.admins?.includes(user.id) || currentChat?.owner === user.id);
    const isGroup = currentChat?.type === 'group';

    return (
        <Dialog open={open} onClose={onClose} className='relative z-10'>
            <div className='fixed inset-0 bg-black/30' aria-hidden='true' />
            <div className='fixed inset-0 flex items-center justify-center p-4'>
                <Dialog.Panel className='w-full max-w-md transform overflow-visible rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-900'>
                    <Dialog.Title className='flex items-center justify-between text-lg font-medium leading-6 text-gray-900 dark:text-white'>
                        {isGroup 
                            ? (isAdmin ? 'Edit Group Settings' : 'Group Info')
                            : 'Chat Info'
                        }
                        <XMarkIcon
                            className='h-6 w-6 cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            onClick={onClose}
                        />
                    </Dialog.Title>
                    <form className='mt-4 flex flex-col gap-4' onSubmit={(e) => { e.preventDefault(); void handleSave(); }}>
                        <div className='flex flex-col items-center'>
                            <div className='relative w-24 h-24'>
                                {isGroup ? (
                                    // Group photo
                                    <>
                                        {groupPhotoURL ? (
                                            <Image
                                                src={groupPhotoURL}
                                                alt='Group profile picture'
                                                layout='fill'
                                                objectFit='cover'
                                                className='rounded-full'
                                            />
                                        ) : (
                                            <UserIcon className='h-24 w-24 text-gray-400' />
                                        )}
                                        {isAdmin && (
                                            <label
                                                htmlFor='group-photo'
                                                className='absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs rounded-full cursor-pointer hover:bg-black/50 transition-colors'
                                            >
                                                Change
                                                <input
                                                    id='group-photo'
                                                    ref={fileInputRef}
                                                    type='file'
                                                    accept='image/*'
                                                    className='hidden'
                                                    onChange={handlePhotoChange}
                                                />
                                            </label>
                                        )}
                                    </>
                                ) : (
                                    // DM user photo
                                    <>
                                        {otherUser?.photoURL ? (
                                            <Image
                                                src={otherUser.photoURL}
                                                alt={`${otherUser.name}'s profile picture`}
                                                layout='fill'
                                                objectFit='cover'
                                                className='rounded-full'
                                            />
                                        ) : (
                                            <UserIcon className='h-24 w-24 text-gray-400' />
                                        )}
                                    </>
                                )}
                            </div>
                            {!isGroup && otherUser && (
                                <div className='mt-2 text-center'>
                                    <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                                        {otherUser.name}
                                    </h3>
                                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                                        @{otherUser.username}
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        {isGroup && (
                            <>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                        Group Name
                                        {isAdmin ? (
                                            <input
                                                type='text'
                                                value={groupName}
                                                onChange={(e) => setGroupName(e.target.value)}
                                                placeholder='Enter group name'
                                                className='mt-1 block w-full py-3 px-4 rounded-md border-gray-300 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                            />
                                        ) : (
                                            <p className='px-4 py-3 font-normal'>
                                                {currentChat?.name || 'No name set'}
                                            </p>
                                        )}
                                    </label>
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                        Description
                                        {isAdmin ? (
                                            <textarea
                                                value={groupDescription}
                                                onChange={(e) => setGroupDescription(e.target.value)}
                                                placeholder='Enter group description'
                                                rows={3}
                                                className='mt-1 py-3 px-4 resize-none block w-full rounded-md border-gray-300 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                            />
                                        ) : (
                                            <p className='px-4 py-3 font-normal'>
                                                {currentChat?.description || "It's empty out here."}
                                            </p>
                                        )}
                                    </label>
                                </div>
                            </>
                        )}
                        
                        {isGroup && isAdmin && (
                            <div className='flex justify-end gap-2 mt-4'>
                                <button
                                    type='button'
                                    onClick={onClose}
                                    disabled={isSaving}
                                    className='px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='submit'
                                    disabled={isSaving || (
                                        groupName.trim() === (currentChat?.name || '') &&
                                        groupDescription.trim() === (currentChat?.description || '') &&
                                        !newPhotoFile
                                    )}
                                    className='px-4 py-2 text-sm rounded-md bg-main-accent text-white hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed'
                                >
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        )}
                    </form>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
