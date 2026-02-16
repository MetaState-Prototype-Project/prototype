import { bookmarkConverter } from '@lib/types/bookmark';
import type { Bookmark } from '@lib/types/bookmark';
import { chatConverter } from '@lib/types/chat';
import { messageConverter } from '@lib/types/message';
import type { Message } from '@lib/types/message';
import { statsConverter } from '@lib/types/stats';
import type { Stats } from '@lib/types/stats';
import { tweetConverter } from '@lib/types/tweet';
import { userConverter } from '@lib/types/user';
import { collection } from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from './app';

export const usersCollection = collection(db, 'users').withConverter(
    userConverter
);

export const tweetsCollection = collection(db, 'tweets').withConverter(
    tweetConverter
);

export function userBookmarksCollection(
    id: string
): CollectionReference<Bookmark> {
    return collection(db, `users/${id}/bookmarks`).withConverter(
        bookmarkConverter
    );
}

export function userStatsCollection(id: string): CollectionReference<Stats> {
    return collection(db, `users/${id}/stats`).withConverter(statsConverter);
}

export const chatsCollection = collection(db, 'chats').withConverter(
    chatConverter
);

export function chatMessagesCollection(
    chatId: string
): CollectionReference<Message> {
    return collection(db, `chats/${chatId}/messages`).withConverter(
        messageConverter
    );
}
