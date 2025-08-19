import type { Bookmark } from '@lib/types/bookmark';
import type { Chat } from '@lib/types/chat';
import type { FilesWithId, ImagesPreview } from '@lib/types/file';
import type { Message } from '@lib/types/message';
import type { Stats } from '@lib/types/stats';
import type { Accent, Theme } from '@lib/types/theme';
import type { EditableUserData } from '@lib/types/user';
import {
    arrayRemove,
    arrayUnion,
    deleteDoc,
    doc,
    getCountFromServer,
    getDoc,
    getDocs,
    increment,
    limit,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import type { Query, WithFieldValue } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from './app';
import {
    chatMessagesCollection,
    chatsCollection,
    tweetsCollection,
    userBookmarksCollection,
    userStatsCollection,
    usersCollection
} from './collections';

export async function checkUsernameAvailability(
    username: string
): Promise<boolean> {
    const { empty } = await getDocs(
        query(usersCollection, where('username', '==', username), limit(1))
    );
    return empty;
}

export async function getCollectionCount<T>(
    collection: Query<T>
): Promise<number> {
    const snapshot = await getCountFromServer(collection);
    return snapshot.data().count;
}

export async function updateUserData(
    userId: string,
    userData: EditableUserData
): Promise<void> {
    const userRef = doc(usersCollection, userId);
    await updateDoc(userRef, {
        ...userData,
        updatedAt: serverTimestamp()
    });
}

export async function updateUserTheme(
    userId: string,
    themeData: { theme?: Theme; accent?: Accent }
): Promise<void> {
    const userRef = doc(usersCollection, userId);
    await updateDoc(userRef, { ...themeData });
}

export async function updateUsername(
    userId: string,
    username?: string
): Promise<void> {
    const userRef = doc(usersCollection, userId);
    await updateDoc(userRef, {
        ...(username && { username }),
        updatedAt: serverTimestamp()
    });
}

export async function managePinnedTweet(
    type: 'pin' | 'unpin',
    userId: string,
    tweetId: string
): Promise<void> {
    const userRef = doc(usersCollection, userId);
    await updateDoc(userRef, {
        updatedAt: serverTimestamp(),
        pinnedTweet: type === 'pin' ? tweetId : null
    });
}

export async function manageFollow(
    type: 'follow' | 'unfollow',
    userId: string,
    targetUserId: string
): Promise<void> {
    const batch = writeBatch(db);

    const userDocRef = doc(usersCollection, userId);
    const targetUserDocRef = doc(usersCollection, targetUserId);

    if (type === 'follow') {
        batch.update(userDocRef, {
            following: arrayUnion(targetUserId),
            updatedAt: serverTimestamp()
        });
        batch.update(targetUserDocRef, {
            followers: arrayUnion(userId),
            updatedAt: serverTimestamp()
        });
    } else {
        batch.update(userDocRef, {
            following: arrayRemove(targetUserId),
            updatedAt: serverTimestamp()
        });
        batch.update(targetUserDocRef, {
            followers: arrayRemove(userId),
            updatedAt: serverTimestamp()
        });
    }

    await batch.commit();
}

export async function removeTweet(tweetId: string): Promise<void> {
    const userRef = doc(tweetsCollection, tweetId);
    await deleteDoc(userRef);
}

export async function uploadImages(
    userId: string,
    files: FilesWithId
): Promise<ImagesPreview | null> {
    if (!files.length) return null;

    const imagesPreview = await Promise.all(
        files.map(async (file) => {
            const { id, name: alt, type } = file;

            const storageRef = ref(storage, `images/${userId}/${id}`);

            await uploadBytesResumable(storageRef, file);

            const src = await getDownloadURL(storageRef);

            return { id, src, alt, type };
        })
    );

    return imagesPreview;
}

export async function manageReply(
    type: 'increment' | 'decrement',
    tweetId: string
): Promise<void> {
    const tweetRef = doc(tweetsCollection, tweetId);

    try {
        await updateDoc(tweetRef, {
            userReplies: increment(type === 'increment' ? 1 : -1),
            updatedAt: serverTimestamp()
        });
    } catch {
        // do nothing, because parent tweet was already deleted
    }
}

export async function manageTotalTweets(
    type: 'increment' | 'decrement',
    userId: string
): Promise<void> {
    const userRef = doc(usersCollection, userId);
    await updateDoc(userRef, {
        totalTweets: increment(type === 'increment' ? 1 : -1),
        updatedAt: serverTimestamp()
    });
}

export async function manageTotalPhotos(
    type: 'increment' | 'decrement',
    userId: string
): Promise<void> {
    const userRef = doc(usersCollection, userId);
    await updateDoc(userRef, {
        totalPhotos: increment(type === 'increment' ? 1 : -1),
        updatedAt: serverTimestamp()
    });
}

export async function ensureUserStatsExists(userId: string): Promise<void> {
    const userStatsRef = doc(userStatsCollection(userId), 'stats');

    // Check if the stats document exists
    const statsDoc = await getDoc(userStatsRef);

    if (!statsDoc.exists()) {
        // Create the stats document with default values
        const defaultStatsData: WithFieldValue<Stats> = {
            likes: [],
            tweets: [],
            updatedAt: serverTimestamp()
        };

        await setDoc(userStatsRef, defaultStatsData);
        console.log(`Created stats document for user ${userId}`);
    }
}

export function manageRetweet(
    type: 'retweet' | 'unretweet',
    userId: string,
    tweetId: string
) {
    return async (): Promise<void> => {
        const batch = writeBatch(db);

        const tweetRef = doc(tweetsCollection, tweetId);
        const userStatsRef = doc(userStatsCollection(userId), 'stats');

        // Ensure stats document exists before updating
        await ensureUserStatsExists(userId);

        if (type === 'retweet') {
            batch.update(tweetRef, {
                userRetweets: arrayUnion(userId),
                updatedAt: serverTimestamp()
            });
            batch.set(
                userStatsRef,
                {
                    tweets: arrayUnion(tweetId),
                    updatedAt: serverTimestamp()
                },
                { merge: true }
            );
        } else {
            batch.update(tweetRef, {
                userRetweets: arrayRemove(userId),
                updatedAt: serverTimestamp()
            });
            batch.set(
                userStatsRef,
                {
                    tweets: arrayRemove(tweetId),
                    updatedAt: serverTimestamp()
                },
                { merge: true }
            );
        }

        await batch.commit();
    };
}

export function manageLike(
    type: 'like' | 'unlike',
    userId: string,
    tweetId: string
) {
    return async (): Promise<void> => {
        console.log(`[DEBUG] Starting ${type} operation for user ${userId} on tweet ${tweetId}`);
        
        const userStatsRef = doc(userStatsCollection(userId));
        const tweetRef = doc(tweetsCollection, tweetId);

        console.log(`[DEBUG] User stats ref: ${userStatsRef.path}`);
        console.log(`[DEBUG] Tweet ref: ${tweetRef.path}`);

        try {
            // Check if user stats document exists, create if it doesn't
            const userStatsDoc = await getDoc(userStatsRef);
            if (!userStatsDoc.exists()) {
                console.log(`[DEBUG] User stats document doesn't exist, creating it...`);
                await setDoc(userStatsRef, {
                    likes: [],
                    tweets: [],
                    updatedAt: serverTimestamp()
                });
                console.log(`[DEBUG] User stats document created successfully`);
            }

            if (type === 'like') {
                console.log(`[DEBUG] Adding like to tweet...`);
                try {
                    await updateDoc(tweetRef, {
                        userLikes: arrayUnion(userId),
                        updatedAt: serverTimestamp()
                    });
                    console.log(`[DEBUG] Tweet updated successfully`);
                } catch (tweetError) {
                    console.error(`[DEBUG] Error updating tweet:`, tweetError);
                    throw tweetError;
                }
                
                console.log(`[DEBUG] Adding tweet to user stats...`);
                try {
                    await setDoc(
                        userStatsRef,
                        {
                            likes: arrayUnion(tweetId),
                            updatedAt: serverTimestamp()
                        },
                        { merge: true }
                    );
                    console.log(`[DEBUG] User stats updated successfully`);
                } catch (statsError) {
                    console.error(`[DEBUG] Error updating user stats:`, statsError);
                    throw statsError;
                }
            } else {
                console.log(`[DEBUG] Removing like from tweet...`);
                try {
                    await updateDoc(tweetRef, {
                        userLikes: arrayRemove(userId),
                        updatedAt: serverTimestamp()
                    });
                    console.log(`[DEBUG] Tweet updated successfully`);
                } catch (tweetError) {
                    console.error(`[DEBUG] Error updating tweet:`, tweetError);
                    throw tweetError;
                }
                
                console.log(`[DEBUG] Removing tweet from user stats...`);
                try {
                    await setDoc(
                        userStatsRef,
                        {
                            likes: arrayRemove(tweetId),
                            updatedAt: serverTimestamp()
                        },
                        { merge: true }
                    );
                    console.log(`[DEBUG] User stats updated successfully`);
                } catch (statsError) {
                    console.error(`[DEBUG] Error updating user stats:`, statsError);
                    throw statsError;
                }
            }
            
            console.log(`[DEBUG] Like operation completed successfully`);
        } catch (error) {
            console.error(`[DEBUG] Error in like operation:`, error);
            throw error;
        }
    };
}

export async function manageBookmark(
    type: 'bookmark' | 'unbookmark',
    userId: string,
    tweetId: string
): Promise<void> {
    const bookmarkRef = doc(userBookmarksCollection(userId), tweetId);

    if (type === 'bookmark') {
        const bookmarkData: WithFieldValue<Bookmark> = {
            id: tweetId,
            createdAt: serverTimestamp()
        };
        await setDoc(bookmarkRef, bookmarkData);
    } else await deleteDoc(bookmarkRef);
}

export async function clearAllBookmarks(userId: string): Promise<void> {
    const bookmarksRef = userBookmarksCollection(userId);
    const bookmarksSnapshot = await getDocs(bookmarksRef);

    const batch = writeBatch(db);

    bookmarksSnapshot.forEach(({ ref }) => batch.delete(ref));

    await batch.commit();
}

export async function createChat(
    type: 'direct' | 'group',
    participants: string[],
    name?: string,
    owner?: string,
    description?: string
): Promise<string> {
    const chatRef = doc(chatsCollection);
    const chatData: WithFieldValue<Chat> = {
        id: chatRef.id,
        type,
        participants,
        ...(name && { name }),
        ...(owner && { owner }),
        ...(description && { description }),
        admins: type === 'group' ? (owner ? [owner] : []) : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    await setDoc(chatRef, chatData);
    return chatRef.id;
}

export async function sendMessage(
    chatId: string,
    senderId: string,
    text: string
): Promise<void> {
    const batch = writeBatch(db);

    const messageId = doc(chatsCollection).id; // Generate a new ID
    const messageRef = doc(chatMessagesCollection(chatId), messageId);

    console.log('error4', chatsCollection, chatId);
    const chatRef = doc(chatsCollection, chatId);

    const messageData: WithFieldValue<Message> = {
        id: messageId,
        chatId,
        senderId,
        text,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        readBy: [senderId]
    };

    batch.set(messageRef, messageData);
    batch.update(chatRef, {
        lastMessage: {
            text,
            senderId,
            timestamp: serverTimestamp()
        },
        updatedAt: serverTimestamp()
    });

    await batch.commit();
}

export async function markMessageAsRead(
    chatId: string,
    messageId: string,
    userId: string
): Promise<void> {
    console.log('[markMessageAsRead] Starting with:', {
        chatId,
        messageId,
        userId
    });

    // First check if the user is a participant in the chat
    const chatRef = doc(chatsCollection, chatId);
    console.log('[markMessageAsRead] Chat ref path:', chatRef.path);

    const chatDoc = await getDoc(chatRef);
    console.log('[markMessageAsRead] Chat doc exists:', chatDoc.exists());

    if (!chatDoc.exists()) {
        console.error('[markMessageAsRead] Chat not found:', chatId);
        throw new Error('Chat not found');
    }

    const chatData = chatDoc.data();
    console.log('[markMessageAsRead] Chat data:', {
        participants: chatData.participants,
        userId,
        isParticipant: chatData.participants.includes(userId)
    });

    if (!chatData.participants.includes(userId)) {
        console.error('[markMessageAsRead] User not in participants:', {
            userId,
            participants: chatData.participants
        });
        throw new Error('User is not a participant in this chat');
    }

    // Then update the message
    const messageRef = doc(chatMessagesCollection(chatId), messageId);
    console.log('[markMessageAsRead] Message ref path:', messageRef.path);

    try {
        await updateDoc(messageRef, {
            readBy: arrayUnion(userId),
            updatedAt: serverTimestamp()
        });
        console.log('[markMessageAsRead] Successfully marked message as read');
    } catch (error) {
        console.error('[markMessageAsRead] Error updating message:', error);
        throw error;
    }
}

export async function getChatParticipants(chatId: string): Promise<string[]> {
    const chatDoc = await getDoc(doc(chatsCollection, chatId));
    if (!chatDoc.exists()) throw new Error('Chat not found');
    return chatDoc.data().participants;
}

export async function addParticipantToChat(
    chatId: string,
    userId: string
): Promise<void> {
    const chatRef = doc(chatsCollection, chatId);
    await updateDoc(chatRef, {
        participants: arrayUnion(userId),
        updatedAt: serverTimestamp()
    });
}

export async function removeParticipantFromChat(
    chatId: string,
    userId: string
): Promise<void> {
    const chatRef = doc(chatsCollection, chatId);
    await updateDoc(chatRef, {
        participants: arrayRemove(userId),
        updatedAt: serverTimestamp()
    });
}

export async function getOrCreateDirectChat(
    userId: string,
    targetUserId: string
): Promise<string> {
    // Check if a direct chat already exists between these users
    const existingChatsQuery = query(
        chatsCollection,
        where('type', '==', 'direct'),
        where('participants', 'array-contains', userId)
    );

    const existingChats = await getDocs(existingChatsQuery);

    for (const doc of existingChats.docs) {
        const chat = doc.data();
        if (chat.participants.includes(targetUserId)) return doc.id;
    }

    // If no existing chat, create a new one
    const newChatRef = doc(chatsCollection);
    const newChat: WithFieldValue<Chat> = {
        id: newChatRef.id,
        type: 'direct',
        participants: [userId, targetUserId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    await setDoc(newChatRef, newChat);
    return newChatRef.id;
}
