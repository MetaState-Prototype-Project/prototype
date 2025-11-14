import { useWindow } from '@lib/context/window-context';
import { useChat } from '@lib/context/chat-context';
import { ChatList } from './chat-list';
import { ChatWindow } from './chat-window';

export function Chat(): JSX.Element {
    const { isMobile } = useWindow();
    const { currentChat } = useChat();

    // On mobile, show only chat list or chat window based on selection
    if (isMobile) {
        return (
            <main className='min-h-full w-full max-w-5xl pt-8 pb-8'>
                {currentChat ? (
                    <div className='h-[calc(100vh-6rem)] rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-black'>
                        <ChatWindow />
                    </div>
                ) : (
                    <div className='h-[calc(100vh-6rem)] rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-black flex flex-col'>
                        <ChatList />
                    </div>
                )}
            </main>
        );
    }

    // On desktop, show both in grid layout
    return (
        <main className='min-h-full w-full max-w-5xl pt-8'>
            <div className='grid h-[calc(100vh-4rem)] grid-cols-1 gap-4 md:grid-cols-[350px_1fr]'>
                <div className='h-[calc(100vh-4rem)] rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-black flex flex-col'>
                    <ChatList />
                </div>
                <div className='h-[calc(100vh-4rem)] rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-black'>
                    <ChatWindow />
                </div>
            </div>
        </main>
    );
}
