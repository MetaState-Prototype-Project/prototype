import { Platform } from './platform.enum';
import { getAuthToken, getApiClient, getUserChats, getChatMessages, getPostComments } from '../utils/api-client';
import { TestUser } from '../utils/user-factory';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from '../utils/user-factory';

// Blabsy populators
import { createPost as createBlabsyPost } from '../populators/blabsy/posts';
import { createComment as createBlabsyComment } from '../populators/blabsy/comments';
import { createLike as createBlabsyLike } from '../populators/blabsy/likes';
import { createChat as createBlabsyChat } from '../populators/blabsy/chats';
import { createMessage as createBlabsyMessage } from '../populators/blabsy/messages';

// Pictique populators
import { createPost as createPictiquePost } from '../populators/pictique/posts';
import { createComment as createPictiqueComment } from '../populators/pictique/comments';
import { createLike as createPictiqueLike } from '../populators/pictique/likes';
import { createChat as createPictiqueChat } from '../populators/pictique/chats';
import { createMessage as createPictiqueMessage } from '../populators/pictique/messages';

export interface CreatedPost {
    id: string;
    text: string | null;
    authorId: string; // ename for Blabsy, user ID for Pictique
}

export interface CreatedComment {
    id: string;
    text: string;
    authorId: string; // ename for Blabsy, user ID for Pictique
    parentId: string; // post/tweet ID
}

export interface CreatedLike {
    userId: string; // ename
    postId: string; // post/tweet ID
    isLiked: boolean;
}

export interface CreatedChat {
    id: string;
    participants: string[];
    name?: string;
}

export interface CreatedMessage {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
}

export class TestSocialUser {
    private token: string | null = null;
    private tokenPromise: Promise<string> | null = null;
    public readonly metadata: {
        platform: Platform;
        ename: string;
        createdAt: Date;
    };

    constructor(
        public readonly platform: Platform,
        public readonly ename: string
    ) {
        this.metadata = {
            platform,
            ename,
            createdAt: new Date(),
        };
    }

    /**
     * Get or fetch authentication token
     */
    private async getToken(): Promise<string> {
        if (this.token) {
            return this.token;
        }

        if (this.tokenPromise) {
            return this.tokenPromise;
        }

        if (this.platform === Platform.BLABSY) {
            // Blabsy doesn't need a token (uses Firestore directly)
            throw new Error('Blabsy platform does not require authentication token');
        }

        // For Pictique, fetch the token
        this.tokenPromise = getAuthToken(this.ename);
        this.token = await this.tokenPromise;
        return this.token;
    }

    /**
     * Create a post
     */
    async createPost(text: string): Promise<CreatedPost> {
        if (this.platform === Platform.BLABSY) {
            const result = await createBlabsyPost(this.ename, text);
            return {
                id: result.id,
                text: result.text,
                authorId: result.createdBy, // ename for Blabsy
            };
        } else {
            const token = await this.getToken();
            const result = await createPictiquePost(token, text);
            return {
                id: result.id,
                text: result.text,
                authorId: result.authorId, // user ID for Pictique
            };
        }
    }

    /**
     * Create a comment/reply
     */
    async createComment(parentId: string, text: string): Promise<CreatedComment> {
        if (this.platform === Platform.BLABSY) {
            const result = await createBlabsyComment(this.ename, parentId, text);
            return {
                id: result.id,
                text: result.text,
                authorId: result.createdBy, // ename for Blabsy
                parentId: result.parentId,
            };
        } else {
            const token = await this.getToken();
            const result = await createPictiqueComment(token, parentId, text);
            return {
                id: result.id,
                text: result.text,
                authorId: result.authorId, // user ID for Pictique
                parentId: result.postId,
            };
        }
    }

    /**
     * Create a like
     */
    async createLike(postId: string): Promise<CreatedLike> {
        if (this.platform === Platform.BLABSY) {
            const result = await createBlabsyLike(this.ename, postId);
            return {
                userId: result.userId,
                postId: result.tweetId, // tweetId -> postId
                isLiked: result.isLiked,
            };
        } else {
            const token = await this.getToken();
            const result = await createPictiqueLike(token, postId, this.ename);
            return {
                userId: result.userId,
                postId: result.postId,
                isLiked: result.isLiked,
            };
        }
    }

    /**
     * Create a chat
     * participantEnames: array of enames (e.g., ["@user1", "@user2"])
     */
    async createChat(participantEnames: string[], name?: string): Promise<CreatedChat> {
        if (this.platform === Platform.BLABSY) {
            return await createBlabsyChat(participantEnames, name);
        } else {
            const token = await this.getToken();
            return await createPictiqueChat(token, participantEnames);
        }
    }

    /**
     * Create a message
     */
    async createMessage(chatId: string, text: string): Promise<CreatedMessage> {
        if (this.platform === Platform.BLABSY) {
            return await createBlabsyMessage(chatId, this.ename, text);
        } else {
            const token = await this.getToken();
            return await createPictiqueMessage(token, chatId, text, this.ename);
        }
    }

    /**
     * Get all posts/tweets
     */
    async getAllPosts(): Promise<any[]> {
        if (this.platform === Platform.BLABSY) {
            initializeFirebase();
            const db = getFirestore();
            const tweetsSnapshot = await db.collection('tweets').get();
            // Filter out replies (only return posts without parent)
            return tweetsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((tweet: any) => !tweet.parent);
        } else {
            const token = await this.getToken();
            const client = getApiClient();
            const response = await client.get('/api/posts/feed', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                params: {
                    limit: 1000,
                },
            });
            
            // Handle different response structures
            if (Array.isArray(response.data)) {
                return response.data;
            } else if (response.data && Array.isArray(response.data.posts)) {
                return response.data.posts;
            } else if (response.data && Array.isArray(response.data.data)) {
                return response.data.data;
            }
            return [];
        }
    }

    /**
     * Get all chats
     */
    async getAllChats(): Promise<any[]> {
        if (this.platform === Platform.BLABSY) {
            initializeFirebase();
            const db = getFirestore();
            const chatsSnapshot = await db.collection('chats').get();
            return chatsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
        } else {
            const token = await this.getToken();
            const chatsResponse: any = await getUserChats(token);
            
            // Handle different response structures
            if (Array.isArray(chatsResponse)) {
                return chatsResponse;
            } else if (chatsResponse && Array.isArray(chatsResponse.chats)) {
                return chatsResponse.chats;
            } else if (chatsResponse && Array.isArray(chatsResponse.data)) {
                return chatsResponse.data;
            }
            return [];
        }
    }

    /**
     * Get all messages for a specific chat
     */
    async getAllMessages(chatId: string): Promise<any[]> {
        if (this.platform === Platform.BLABSY) {
            initializeFirebase();
            const db = getFirestore();
            const messagesSnapshot = await db
                .collection('chats')
                .doc(chatId)
                .collection('messages')
                .orderBy('createdAt', 'desc')
                .get();
            return messagesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
        } else {
            const token = await this.getToken();
            const messagesResponse: any = await getChatMessages(chatId, token);
            
            // Handle different response structures
            if (Array.isArray(messagesResponse)) {
                return messagesResponse;
            } else if (messagesResponse && Array.isArray(messagesResponse.messages)) {
                return messagesResponse.messages;
            } else if (messagesResponse && Array.isArray(messagesResponse.data)) {
                return messagesResponse.data;
            }
            return [];
        }
    }

    /**
     * Get all comments for a specific post
     */
    async getAllComments(postId: string): Promise<any[]> {
        if (this.platform === Platform.BLABSY) {
            initializeFirebase();
            const db = getFirestore();
            // Comments in Blabsy are replies (tweets with parent)
            const repliesSnapshot = await db
                .collection('tweets')
                .where('parent.id', '==', postId)
                .get();
            return repliesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
        } else {
            const token = await this.getToken();
            const commentsResponse: any = await getPostComments(postId, token);
            
            // Handle different response structures
            if (Array.isArray(commentsResponse)) {
                return commentsResponse;
            } else if (commentsResponse && Array.isArray(commentsResponse.comments)) {
                return commentsResponse.comments;
            } else if (commentsResponse && Array.isArray(commentsResponse.data)) {
                return commentsResponse.data;
            }
            return [];
        }
    }
}

