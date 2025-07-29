import { ChatList } from './chat-list';
import { ChatWindow } from './chat-window';

export function Chat(): JSX.Element {
    return (
        <main className='min-h-screen w-full max-w-5xl mt-8'>
            <div className='grid h-[calc(100vh-4rem)] grid-cols-1 gap-4 md:grid-cols-[350px_1fr]'>
                <div className='h-full rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-black'>
                    <ChatList />
                </div>
                <div className='h-full rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-black'>
                    <ChatWindow />
                </div>
            </div>
        </main>
    );
}
