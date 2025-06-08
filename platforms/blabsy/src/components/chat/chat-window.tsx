import { useState, useRef, useEffect } from 'react';
import { useChat } from '@lib/context/chat-context';
import { useAuth } from '@lib/context/auth-context';
import { formatDistanceToNow } from 'date-fns';
import type { Message } from '@lib/types/message';

export function ChatWindow(): JSX.Element {
    const { currentChat, messages, sendNewMessage, markAsRead } = useChat();
    const { user } = useAuth();
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!currentChat || !user) return;

        // Mark unread messages as read
        messages?.forEach((message) => {
            if (
                message.senderId !== user.id &&
                !message.readBy.includes(user.id)
            ) {
                void markAsRead(message.id);
            }
        });
    }, [currentChat, messages, user, markAsRead]);

    if (!currentChat) {
        return (
            <div className='flex h-full items-center justify-center'>
                <p className='text-gray-500'>
                    Select a chat to start messaging
                </p>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            await sendNewMessage(newMessage);
            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    return (
        <div className='flex h-full flex-col'>
            <div className='flex-1 overflow-y-auto p-4'>
                <div className='flex flex-col gap-4'>
                    {messages?.map((message) => (
                        <MessageItem
                            key={message.id}
                            message={message}
                            isOwnMessage={message.senderId === user?.id}
                        />
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            <form
                onSubmit={handleSubmit}
                className='border-t border-gray-200 p-4 dark:border-gray-800'
            >
                <div className='flex gap-2'>
                    <input
                        type='text'
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder='Type a message...'
                        className='flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800'
                    />
                    <button
                        type='submit'
                        disabled={!newMessage.trim()}
                        className='rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary/90 disabled:opacity-50'
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
}

type MessageItemProps = {
    message: Message;
    isOwnMessage: boolean;
};

function MessageItem({ message, isOwnMessage }: MessageItemProps): JSX.Element {
    return (
        <div
            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
        >
            <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isOwnMessage
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-gray-800'
                }`}
            >
                <p className='break-words'>{message.text}</p>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                    {message.createdAt?.toDate && formatDistanceToNow(message.createdAt.toDate(), {
                        addSuffix: true
                    })}
                </p>
            </div>
        </div>
    );
}

