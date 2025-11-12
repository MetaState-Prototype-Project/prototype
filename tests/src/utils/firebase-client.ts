import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { initializeFirebase } from './user-factory';

let firestore: FirebaseFirestore.Firestore | null = null;

function getFirestoreInstance(): FirebaseFirestore.Firestore {
  if (!firestore) {
    initializeFirebase();
    firestore = getFirestore();
    if (!firestore) {
      throw new Error('Failed to initialize Firestore');
    }
  }
  return firestore;
}

export interface EditableUserData {
  name?: string;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  photoURL?: string | null;
  coverPhotoURL?: string | null;
}

/**
 * Update user data in Firestore (mimics frontend updateUserData)
 */
export async function updateUserData(
  userId: string,
  userData: EditableUserData
): Promise<void> {
  const db = getFirestoreInstance();
  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    ...userData,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Create a tweet in Firestore
 */
export async function createTweet(
  userId: string,
  text: string | null,
  images: any[] | null = null,
  parentId?: string
): Promise<string> {
  const db = getFirestoreInstance();
  const tweetRef = db.collection('tweets').doc();
  
  let parent = null;
  if (parentId) {
    const parentTweet = await db.collection('tweets').doc(parentId).get();
    if (parentTweet.exists) {
      const parentData = parentTweet.data();
      parent = {
        id: parentId,
        username: parentData?.username || 'unknown',
      };
    }
  }

  const tweetData = {
    id: tweetRef.id,
    text: text || null,
    images: images || null,
    parent: parent,
    userLikes: [],
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    userReplies: 0,
    userRetweets: [],
  };

  await tweetRef.set(tweetData);

  // Increment total tweets
  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    totalTweets: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return tweetRef.id;
}

/**
 * Toggle like on a tweet
 */
export async function toggleLike(
  userId: string,
  tweetId: string,
  isLiked: boolean
): Promise<void> {
  const db = getFirestoreInstance();
  const tweetRef = db.collection('tweets').doc(tweetId);
  const userStatsRef = db.collection('users').doc(userId).collection('stats').doc('stats');

  // Ensure stats document exists
  const statsDoc = await userStatsRef.get();
  if (!statsDoc.exists) {
    await userStatsRef.set({
      likes: [],
      tweets: [],
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  if (isLiked) {
    // Like the tweet
    await tweetRef.update({
      userLikes: FieldValue.arrayUnion(userId),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await userStatsRef.set({
      likes: FieldValue.arrayUnion(tweetId),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } else {
    // Unlike the tweet
    await tweetRef.update({
      userLikes: FieldValue.arrayRemove(userId),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await userStatsRef.set({
      likes: FieldValue.arrayRemove(tweetId),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

/**
 * Create a reply (comment) to a tweet
 */
export async function createReply(
  userId: string,
  parentTweetId: string,
  text: string
): Promise<string> {
  const db = getFirestoreInstance();
  
  // Get parent tweet to extract username
  const parentTweet = await db.collection('tweets').doc(parentTweetId).get();
  if (!parentTweet.exists) {
    throw new Error('Parent tweet not found');
  }

  const parentData = parentTweet.data();
  const parentUser = await db.collection('users').doc(parentData?.createdBy).get();
  const parentUserData = parentUser.data();

  const replyRef = db.collection('tweets').doc();
  const replyData = {
    id: replyRef.id,
    text: text,
    images: null,
    parent: {
      id: parentTweetId,
      username: parentUserData?.username || 'unknown',
    },
    userLikes: [],
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    userReplies: 0,
    userRetweets: [],
  };

  await replyRef.set(replyData);

  // Increment reply count on parent
  await db.collection('tweets').doc(parentTweetId).update({
    userReplies: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Increment total tweets for user
  await db.collection('users').doc(userId).update({
    totalTweets: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return replyRef.id;
}

/**
 * Create a chat
 */
export async function createChat(
  participants: string[],
  name?: string,
  owner?: string,
  description?: string
): Promise<string> {
  const db = getFirestoreInstance();
  const chatsCollection = db.collection('chats');
  
  // Check for existing DM (2 participants, no name) before creating
  const isDM = participants.length === 2 && !name;
  
  if (isDM) {
    // Check if a direct chat already exists between these users
    const existingChatsQuery = chatsCollection.where('participants', 'array-contains', participants[0]);
    const existingChatsSnapshot = await existingChatsQuery.get();
    
    for (const doc of existingChatsSnapshot.docs) {
      const chat = doc.data();
      // Check if it's a direct chat (2 participants) with same participants
      if (
        chat.participants &&
        Array.isArray(chat.participants) &&
        chat.participants.length === 2 &&
        chat.participants.includes(participants[0]) &&
        chat.participants.includes(participants[1])
      ) {
        return doc.id; // Return existing chat ID
      }
    }
  }
  
  // No existing DM found or it's a group chat - create new
  const chatRef = chatsCollection.doc();
  const isGroup = participants.length > 2;
  
  const chatData = {
    id: chatRef.id,
    participants: participants,
    ...(name && { name }),
    ...(owner && { owner }),
    ...(description && { description }),
    admins: isGroup ? (owner ? [owner] : []) : [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await chatRef.set(chatData);
  return chatRef.id;
}

/**
 * Send a message in a chat
 */
export async function sendMessage(
  chatId: string,
  senderId: string,
  text: string
): Promise<string> {
  const db = getFirestoreInstance();
  const messageId = db.collection('chats').doc().id; // Generate ID
  const messageRef = db.collection('chats').doc(chatId).collection('messages').doc(messageId);
  const chatRef = db.collection('chats').doc(chatId);

  const messageData = {
    id: messageId,
    chatId: chatId,
    senderId: senderId,
    text: text,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    readBy: [senderId],
  };

  await messageRef.set(messageData);
  await chatRef.update({
    lastMessage: {
      text: text,
      senderId: senderId,
      timestamp: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  return messageId;
}

/**
 * Get user document from Firestore
 */
export async function getUser(userId: string): Promise<any | null> {
  const db = getFirestoreInstance();
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    return null;
  }
  return userDoc.data();
}

/**
 * Get tweet document from Firestore
 */
export async function getTweet(tweetId: string): Promise<any | null> {
  const db = getFirestoreInstance();
  const tweetDoc = await db.collection('tweets').doc(tweetId).get();
  if (!tweetDoc.exists) {
    return null;
  }
  return tweetDoc.data();
}

/**
 * Get chat document from Firestore
 */
export async function getChat(chatId: string): Promise<any | null> {
  const db = getFirestoreInstance();
  const chatDoc = await db.collection('chats').doc(chatId).get();
  if (!chatDoc.exists) {
    return null;
  }
  return chatDoc.data();
}

/**
 * Get messages from a chat
 */
export async function getChatMessages(chatId: string, limit: number = 50): Promise<any[]> {
  const db = getFirestoreInstance();
  const messagesSnapshot = await db
    .collection('chats')
    .doc(chatId)
    .collection('messages')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  return messagesSnapshot.docs.map(doc => doc.data());
}

