import { getUser as getFirebaseUser, getTweet, getChat, getChatMessages } from './firebase-client';
import {
  getUser as getApiUser,
  searchUsers,
  getPost,
  getChatMessages as getApiChatMessages,
  getChat as getApiChat,
  getPostComments,
  getApiClient,
} from './api-client';
import { config } from '../config/env';
import { generateToken } from './api-client';
import axios from 'axios';

/**
 * Wait for sync to complete
 */
export async function waitForSync(waitMs: number = config.syncBufferTime): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, waitMs));
}

/**
 * Check if enough time has passed since last update (prevention mechanism)
 */
export function checkPreventionWindow(lastUpdateTime: number): boolean {
  const timeSinceUpdate = Date.now() - lastUpdateTime;
  return timeSinceUpdate >= config.preventionWindow;
}

/**
 * Verify user sync from blabsy to pictique
 */
export async function verifyUserSyncBlabsyToPictique(
  ename: string,
  expectedData: {
    name?: string;
    bio?: string | null;
    location?: string | null;
    website?: string | null;
    photoURL?: string | null;
    coverPhotoURL?: string | null;
    username?: string;
  }
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // Wait for sync
    await waitForSync();
    
    // Find user in pictique by ename
    const pictiqueUsers = await searchUsers(ename);
    const pictiqueUser = pictiqueUsers.find((u: any) => u.ename === ename);
    
    if (!pictiqueUser) {
      errors.push(`User ${ename} not found in pictique`);
      return { success: false, errors };
    }
    
    // Verify field mappings
    if (expectedData.name && pictiqueUser.name !== expectedData.name) {
      errors.push(`Name mismatch: expected "${expectedData.name}", got "${pictiqueUser.name}"`);
    }
    
    if (expectedData.bio !== undefined) {
      const expectedBio = expectedData.bio || null;
      const actualBio = pictiqueUser.description || null;
      if (actualBio !== expectedBio) {
        errors.push(`Bio mismatch: expected "${expectedBio}", got "${actualBio}"`);
      }
    }
    
    if (expectedData.username && pictiqueUser.handle !== expectedData.username) {
      errors.push(`Handle mismatch: expected "${expectedData.username}", got "${pictiqueUser.handle}"`);
    }
    
    if (expectedData.photoURL && pictiqueUser.avatarUrl !== expectedData.photoURL) {
      errors.push(`Avatar mismatch: expected "${expectedData.photoURL}", got "${pictiqueUser.avatarUrl}"`);
    }
    
    if (expectedData.coverPhotoURL !== undefined) {
      const expectedBanner = expectedData.coverPhotoURL || null;
      const actualBanner = pictiqueUser.bannerUrl || null;
      if (actualBanner !== expectedBanner) {
        errors.push(`Banner mismatch: expected "${expectedBanner}", got "${actualBanner}"`);
      }
    }
    
    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    errors.push(`Error verifying user sync: ${error.message}`);
    return { success: false, errors };
  }
}

/**
 * Verify user sync from pictique to blabsy
 */
export async function verifyUserSyncPictiqueToBlabsy(
  ename: string,
  expectedData: {
    name?: string;
    description?: string | null;
    handle?: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
  }
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // Wait for sync
    await waitForSync();
    
    // Get user from blabsy Firestore
    const blabsyUser = await getFirebaseUser(ename);
    
    if (!blabsyUser) {
      errors.push(`User ${ename} not found in blabsy`);
      return { success: false, errors };
    }
    
    // Verify field mappings
    if (expectedData.name && blabsyUser.name !== expectedData.name) {
      errors.push(`Name mismatch: expected "${expectedData.name}", got "${blabsyUser.name}"`);
    }
    
    if (expectedData.description !== undefined) {
      const expectedBio = expectedData.description || null;
      const actualBio = blabsyUser.bio || null;
      if (actualBio !== expectedBio) {
        errors.push(`Bio mismatch: expected "${expectedBio}", got "${actualBio}"`);
      }
    }
    
    if (expectedData.handle && blabsyUser.username !== expectedData.handle) {
      errors.push(`Username mismatch: expected "${expectedData.handle}", got "${blabsyUser.username}"`);
    }
    
    if (expectedData.avatarUrl !== undefined) {
      const expectedPhoto = expectedData.avatarUrl || null;
      const actualPhoto = blabsyUser.photoURL || null;
      if (actualPhoto !== expectedPhoto) {
        errors.push(`Photo mismatch: expected "${expectedPhoto}", got "${actualPhoto}"`);
      }
    }
    
    if (expectedData.bannerUrl !== undefined) {
      const expectedCover = expectedData.bannerUrl || null;
      const actualCover = blabsyUser.coverPhotoURL || null;
      if (actualCover !== expectedCover) {
        errors.push(`Cover mismatch: expected "${expectedCover}", got "${actualCover}"`);
      }
    }
    
    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    errors.push(`Error verifying user sync: ${error.message}`);
    return { success: false, errors };
  }
}

/**
 * Verify post/tweet sync from pictique to blabsy
 * Searches by author and text content since IDs differ between platforms
 */
export async function verifyPostSyncPictiqueToBlabsy(
  postId: string,
  expectedData: {
    text: string;
    authorId: string;
  }
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    await waitForSync();
    
    // Search for tweet by author and text content (IDs differ between platforms)
    // Get user's tweets from Firestore and find matching one
    const { getFirestore } = require('firebase-admin/firestore');
    const { initializeFirebase } = require('./user-factory');
    initializeFirebase();
    const db = getFirestore();
    
    // Query tweets by author (ename) and text
    const tweetsSnapshot = await db
      .collection('tweets')
      .where('createdBy', '==', expectedData.authorId)
      .where('text', '==', expectedData.text)
      .limit(10)
      .get();
    
    if (tweetsSnapshot.empty) {
      errors.push(`Tweet not found in blabsy: text="${expectedData.text}", author="${expectedData.authorId}"`);
      return { success: false, errors };
    }
    
    return {
      success: true,
      errors: [],
    };
  } catch (error: any) {
    errors.push(`Error verifying post sync: ${error.message}`);
    return { success: false, errors };
  }
}

/**
 * Verify post/tweet sync from blabsy to pictique
 * Searches by author and text content since IDs differ between platforms
 */
export async function verifyPostSyncBlabsyToPictique(
  tweetId: string,
  expectedData: {
    text: string | null;
    createdBy: string;
  },
  token: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    await waitForSync();
    
    // Search for post by author and text content (IDs differ between platforms)
    const client = getApiClient();
    const response = await client.get('/api/posts/feed', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        limit: 100,
      },
    });
    
    const posts = response.data || [];
    
    // Find post by matching author ename and text content
    const post = posts.find((p: any) => {
      const authorMatches = p.author?.ename === expectedData.createdBy || p.author?.id === expectedData.createdBy;
      const textMatches = p.text === expectedData.text;
      return authorMatches && textMatches;
    });
    
    if (!post) {
      errors.push(`Post not found in pictique: text="${expectedData.text}", author="${expectedData.createdBy}"`);
      return { success: false, errors };
    }
    
    return {
      success: true,
      errors: [],
    };
  } catch (error: any) {
    errors.push(`Error verifying post sync: ${error.message}`);
    return { success: false, errors };
  }
}

/**
 * Verify comment sync from pictique to blabsy
 */
export async function verifyCommentSyncPictiqueToBlabsy(
  commentId: string,
  expectedData: {
    text: string;
    postId: string;
  }
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    await waitForSync();
    
    // Comments in blabsy are replies (tweets with parent)
    const reply = await getTweet(commentId);
    
    if (!reply) {
      errors.push(`Reply ${commentId} not found in blabsy`);
      return { success: false, errors };
    }
    
    if (reply.text !== expectedData.text) {
      errors.push(`Text mismatch: expected "${expectedData.text}", got "${reply.text}"`);
    }
    
    if (reply.parent?.id !== expectedData.postId) {
      errors.push(`Parent mismatch: expected "${expectedData.postId}", got "${reply.parent?.id}"`);
    }
    
    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    errors.push(`Error verifying comment sync: ${error.message}`);
    return { success: false, errors };
  }
}

/**
 * Verify comment sync from blabsy to pictique
 */
export async function verifyCommentSyncBlabsyToPictique(
  replyId: string,
  expectedData: {
    text: string;
    parentTweetId: string;
  },
  token: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    await waitForSync();
    
    // Get comments for the parent post
    const comments = await getPostComments(expectedData.parentTweetId, token);
    const comment = comments.find((c: any) => c.id === replyId);
    
    if (!comment) {
      errors.push(`Comment ${replyId} not found in pictique`);
      return { success: false, errors };
    }
    
    if (comment.text !== expectedData.text) {
      errors.push(`Text mismatch: expected "${expectedData.text}", got "${comment.text}"`);
    }
    
    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    errors.push(`Error verifying comment sync: ${error.message}`);
    return { success: false, errors };
  }
}

/**
 * Verify like sync from pictique to blabsy
 */
export async function verifyLikeSyncPictiqueToBlabsy(
  postId: string,
  userId: string,
  isLiked: boolean
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    await waitForSync();
    
    const tweet = await getTweet(postId);
    
    if (!tweet) {
      errors.push(`Tweet ${postId} not found in blabsy`);
      return { success: false, errors };
    }
    
    const hasLike = tweet.userLikes?.includes(userId) || false;
    
    if (hasLike !== isLiked) {
      errors.push(`Like status mismatch: expected ${isLiked}, got ${hasLike}`);
    }
    
    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    errors.push(`Error verifying like sync: ${error.message}`);
    return { success: false, errors };
  }
}

/**
 * Verify like sync from blabsy to pictique
 */
export async function verifyLikeSyncBlabsyToPictique(
  tweetId: string,
  userId: string,
  isLiked: boolean,
  token: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    await waitForSync();
    
    const post = await getPost(tweetId, token);
    
    if (!post) {
      errors.push(`Post ${tweetId} not found in pictique`);
      return { success: false, errors };
    }
    
    const hasLike = post.likedBy?.some((u: any) => u.id === userId) || false;
    
    if (hasLike !== isLiked) {
      errors.push(`Like status mismatch: expected ${isLiked}, got ${hasLike}`);
    }
    
    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    errors.push(`Error verifying like sync: ${error.message}`);
    return { success: false, errors };
  }
}

/**
 * Verify message sync from pictique to blabsy
 */
export async function verifyMessageSyncPictiqueToBlabsy(
  messageId: string,
  chatId: string,
  expectedData: {
    text: string;
    senderId: string;
  }
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    await waitForSync();
    
    const messages = await getChatMessages(chatId);
    const message = messages.find((m: any) => m.id === messageId);
    
    if (!message) {
      errors.push(`Message ${messageId} not found in blabsy`);
      return { success: false, errors };
    }
    
    if (message.text !== expectedData.text) {
      errors.push(`Text mismatch: expected "${expectedData.text}", got "${message.text}"`);
    }
    
    if (message.senderId !== expectedData.senderId) {
      errors.push(`Sender mismatch: expected "${expectedData.senderId}", got "${message.senderId}"`);
    }
    
    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    errors.push(`Error verifying message sync: ${error.message}`);
    return { success: false, errors };
  }
}

/**
 * Verify message sync from blabsy to pictique
 */
export async function verifyMessageSyncBlabsyToPictique(
  messageId: string,
  chatId: string,
  expectedData: {
    text: string;
    senderId: string;
  },
  token: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    await waitForSync();
    
    const messages = await getApiChatMessages(chatId, token);
    const message = messages.find((m: any) => m.id === messageId);
    
    if (!message) {
      errors.push(`Message ${messageId} not found in pictique`);
      return { success: false, errors };
    }
    
    if (message.text !== expectedData.text) {
      errors.push(`Text mismatch: expected "${expectedData.text}", got "${message.text}"`);
    }
    
    if (message.sender?.id !== expectedData.senderId) {
      errors.push(`Sender mismatch: expected "${expectedData.senderId}", got "${message.sender?.id}"`);
    }
    
    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    errors.push(`Error verifying message sync: ${error.message}`);
    return { success: false, errors };
  }
}

/**
 * Verify chat sync from pictique to blabsy
 */
export async function verifyChatSyncPictiqueToBlabsy(
  chatId: string,
  expectedData: {
    participants: string[];
    name?: string;
  }
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    await waitForSync();
    
    const chat = await getChat(chatId);
    
    if (!chat) {
      errors.push(`Chat ${chatId} not found in blabsy`);
      return { success: false, errors };
    }
    
    // Check participants (order might differ, so check as sets)
    const expectedParticipants = new Set(expectedData.participants);
    const actualParticipants = new Set(chat.participants || []);
    
    if (expectedParticipants.size !== actualParticipants.size) {
      errors.push(`Participant count mismatch: expected ${expectedParticipants.size}, got ${actualParticipants.size}`);
    }
    
    for (const participant of expectedParticipants) {
      if (!actualParticipants.has(participant)) {
        errors.push(`Missing participant: ${participant}`);
      }
    }
    
    if (expectedData.name && chat.name !== expectedData.name) {
      errors.push(`Name mismatch: expected "${expectedData.name}", got "${chat.name}"`);
    }
    
    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    errors.push(`Error verifying chat sync: ${error.message}`);
    return { success: false, errors };
  }
}

/**
 * Verify chat sync from blabsy to pictique
 */
export async function verifyChatSyncBlabsyToPictique(
  chatId: string,
  expectedData: {
    participants: string[];
    name?: string;
  },
  token: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    await waitForSync();
    
    const chat = await getApiChat(chatId, token);
    
    if (!chat) {
      errors.push(`Chat ${chatId} not found in pictique`);
      return { success: false, errors };
    }
    
    // Check participants
    const expectedParticipants = new Set(expectedData.participants);
    const actualParticipants = new Set(
      chat.participants?.map((p: any) => p.id || p) || []
    );
    
    if (expectedParticipants.size !== actualParticipants.size) {
      errors.push(`Participant count mismatch: expected ${expectedParticipants.size}, got ${actualParticipants.size}`);
    }
    
    for (const participant of expectedParticipants) {
      if (!actualParticipants.has(participant)) {
        errors.push(`Missing participant: ${participant}`);
      }
    }
    
    if (expectedData.name && chat.name !== expectedData.name) {
      errors.push(`Name mismatch: expected "${expectedData.name}", got "${chat.name}"`);
    }
    
    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    errors.push(`Error verifying chat sync: ${error.message}`);
    return { success: false, errors };
  }
}

