import { ChatList } from './chat-list';
import { ChatWindow } from './chat-window';

export function Chat(): JSX.Element {
    return (
        <div className="grid h-[calc(100vh-4rem)] grid-cols-[300px_1fr] gap-4 p-4">
            <div className="h-full overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <ChatList />
            </div>
            <div className="h-full overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <ChatWindow />
            </div>
        </div>
    );
} 