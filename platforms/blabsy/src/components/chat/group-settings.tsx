import { useEffect, useState } from 'react';
import { useChat } from '@lib/context/chat-context';
import { useAuth } from '@lib/context/auth-context';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@lib/firebase/app';
import type { User } from '@lib/types/user';
import { Dialog } from '@headlessui/react';
import { UserIcon, XMarkIcon } from '@heroicons/react/24/outline';

export function GroupSettings({
    open,
    onClose
}: {
    open: boolean;
    onClose: () => void;
}): JSX.Element {
    const { currentChat } = useChat();
    const { user } = useAuth();
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

    return (
        <Dialog open={open} onClose={onClose} className='relative z-10'>
            <div className='fixed inset-0 bg-black/30' aria-hidden='true' />
            <div className='fixed inset-0 flex items-center justify-center p-4'>
                <Dialog.Panel className='w-full max-w-md transform overflow-visible rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-900'>
                    <Dialog.Title className='flex items-center justify-between text-lg font-medium leading-6 text-gray-900 dark:text-white'>
                        {(user && currentChat?.admins?.includes(user?.id)) ||
                        currentChat?.owner === user?.id
                            ? 'Edit Group Settings'
                            : 'Group Info'}
                        <XMarkIcon
                            className='h-6 w-6 cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            onClick={onClose}
                        />
                    </Dialog.Title>
                    <form className='mt-4 flex flex-col gap-4'>
                        <div className='flex flex-col items-center'>
                            <div className='relative w-24 h-24'>
                                {otherUser?.photoURL ? (
                                    <Image
                                        src={otherUser?.photoURL}
                                        alt='Group profile picture'
                                        layout='fill'
                                        objectFit='cover'
                                        className='rounded-full'
                                    />
                                ) : (
                                    <UserIcon className='h-24 w-24 text-gray-400' />
                                )}
                                {(user &&
                                    currentChat?.admins?.includes(user?.id)) ||
                                    (currentChat?.owner === user?.id && (
                                        <label
                                            htmlFor='group-photo'
                                            className='absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs rounded-full cursor-pointer'
                                        >
                                            Change
                                            <input
                                                id='group-photo'
                                                type='file'
                                                accept='image/*'
                                                className='hidden'
                                            />
                                        </label>
                                    ))}
                            </div>
                        </div>
                        <div>
                            {/* biome-ignore lint/a11y/noLabelWithoutControl: <explanation> */}
                            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                Group Name
                                {(user &&
                                    currentChat?.admins?.includes(user?.id)) ||
                                currentChat?.owner === user?.id ? (
                                    <input
                                        type='text'
                                        value={currentChat?.name || ''}
                                        className='mt-1 block w-full py-3 px-4 rounded-md border-gray-300 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white'
                                    />
                                ) : (
                                    <p className='px-4 py-3 font-normal'>
                                        {currentChat?.name}
                                    </p>
                                )}
                            </label>
                        </div>
                        <div>
                            {/* biome-ignore lint/a11y/noLabelWithoutControl: <explanation> */}
                            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                Description
                                {(user &&
                                    currentChat?.admins?.includes(user?.id)) ||
                                currentChat?.owner === user?.id ? (
                                    <textarea
                                        value={currentChat?.description || ''}
                                        rows={3}
                                        className='mt-1 py-3 px-4 resize-none block w-full rounded-md border-gray-300 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white'
                                    />
                                ) : (
                                    <p className='px-4 py-3 font-normal'>
                                        {currentChat?.description ||
                                            "It's empty out here."}
                                    </p>
                                )}
                            </label>
                        </div>
                        {((user && currentChat?.admins?.includes(user?.id)) ||
                            currentChat?.owner === user?.id) && (
                            <div className='flex justify-end gap-2 mt-4'>
                                <button
                                    type='button'
                                    onClick={onClose}
                                    className='px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='button'
                                    className='px-4 py-2 text-sm rounded-md bg-main-accent text-white hover:brightness-90'
                                >
                                    Save
                                </button>
                            </div>
                        )}
                    </form>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
