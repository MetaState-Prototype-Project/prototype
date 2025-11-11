import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env';
import jwt from 'jsonwebtoken';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EventSource = require('eventsource');

let apiClient: AxiosInstance | null = null;

// Token cache: map of ename -> token
const tokenCache = new Map<string, string>();

/**
 * Get or create axios instance for pictique-api
 */
export function getApiClient(): AxiosInstance {
  if (!apiClient) {
    apiClient = axios.create({
      baseURL: config.pictiqueBaseUri,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  return apiClient;
}

/**
 * Generate JWT token for a user ID (for testing purposes)
 */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwtSecret!, { expiresIn: '7d' });
}

/**
 * Get authentication token for a user using the proper auth flow:
 * 1. Get offer from /api/auth/offer
 * 2. Extract session ID from offer URI
 * 3. Start SSE stream on /api/auth/<session-id>
 * 4. POST to /api/auth with ename and session
 * 5. Wait for token from SSE stream
 * 
 * Tokens are cached per user (ename) to avoid re-authentication
 */
export async function getAuthToken(ename: string): Promise<string> {
  // Check cache first
  if (tokenCache.has(ename)) {
    return tokenCache.get(ename)!;
  }
  
  const client = getApiClient();
  
  // Step 1: Get offer
  const offerResponse = await client.get('/api/auth/offer');
  const offerUri = offerResponse.data.uri;
  
  // Step 2: Extract session ID from URI
  const uriObj = new URL(offerUri);
  const sessionId = uriObj.searchParams.get('session');
  
  if (!sessionId) {
    throw new Error('Session ID not found in offer URI');
  }
  
  // Step 3: Set up SSE stream listener using axios with streaming
  const tokenPromise = new Promise<string>((resolve, reject) => {
    const sseUrl = `${config.pictiqueBaseUri}/api/auth/sessions/${sessionId}`;
    let postSent = false;
    let streamClosed = false;
    
    const timeout = setTimeout(() => {
      streamClosed = true;
      reject(new Error('Authentication timeout: No token received from SSE stream'));
    }, 30000); // 30 second timeout
    
    // Step 4: POST to /api/auth while SSE stream is active
    const sendAuthPost = async () => {
      if (postSent) return;
      postSent = true;
      
      try {
        // Don't await - fire and forget to avoid blocking
        client.post('/api/auth', {
          ename: ename,
          session: sessionId,
        }).catch((error: any) => {
          // Don't reject here - let the SSE stream handle it
          // The server might still emit the event even if POST fails
        });
      } catch (error: any) {
        // Don't reject - let SSE stream handle it
      }
    };
    
    // Use EventSource library for SSE (designed for Node.js)
    const eventSource = new EventSource(sseUrl, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
    
    eventSource.onopen = () => {
      // Send POST as soon as connection opens
      setTimeout(() => {
        sendAuthPost();
      }, 100);
    };
    
    // Also try to send POST after a short delay as fallback
    setTimeout(() => {
      if (!postSent && !streamClosed) {
        sendAuthPost();
      }
    }, 500);
    
    eventSource.onmessage = (event: MessageEvent) => {
      if (streamClosed) return;
      
      try {
        const data = JSON.parse(event.data);
        if (data.token) {
          // Cache the token
          tokenCache.set(ename, data.token);
          streamClosed = true;
          clearTimeout(timeout);
          eventSource.close();
          resolve(data.token);
        }
      } catch (error) {
        // Ignore parse errors
      }
    };
    
    eventSource.onerror = (error: any) => {
      if (streamClosed) return;
      
      // readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
      if (eventSource.readyState === EventSource.CLOSED) {
        streamClosed = true;
        clearTimeout(timeout);
        eventSource.close();
        reject(new Error(`SSE connection closed: ${error?.message || 'Connection closed'}`));
      }
      // If readyState is CONNECTING (0) or OPEN (1), continue waiting
    };
  });
  
  return tokenPromise;
}

/**
 * Get user by ID from pictique-api
 */
export async function getUser(userId: string, token: string): Promise<any> {
  const client = getApiClient();
  const response = await client.get(`/api/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}

/**
 * Get current user from pictique-api
 */
export async function getCurrentUser(token: string): Promise<any> {
  const client = getApiClient();
  const response = await client.get('/api/users', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}

/**
 * Search users by ename or name
 */
export async function searchUsers(query: string): Promise<any[]> {
  const client = getApiClient();
  const response = await client.get('/api/users/search/ename-name', {
    params: { q: query },
  });
  return response.data || [];
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  data: { handle?: string; avatar?: string; name?: string },
  token: string
): Promise<any> {
  const client = getApiClient();
  const response = await client.patch(
    '/api/users',
    {
      handle: data.handle,
      avatar: data.avatar,
      name: data.name,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
}

/**
 * Create a post
 */
export async function createPost(
  data: { text: string; images?: string[]; hashtags?: string[] },
  token: string
): Promise<any> {
  const client = getApiClient();
  const response = await client.post(
    '/api/posts',
    {
      text: data.text,
      images: data.images,
      hashtags: data.hashtags,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
}

/**
 * Toggle like on a post
 */
export async function toggleLike(postId: string, token: string): Promise<any> {
  const client = getApiClient();
  const response = await client.post(
    `/api/posts/${postId}/like`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
}

/**
 * Create a comment
 */
export async function createComment(
  postId: string,
  text: string,
  token: string
): Promise<any> {
  const client = getApiClient();
  const response = await client.post(
    '/api/comments',
    {
      postId,
      text,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
}

/**
 * Get comments for a post
 */
export async function getPostComments(postId: string, token: string): Promise<any[]> {
  const client = getApiClient();
  const response = await client.get(`/api/posts/${postId}/comments`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data || [];
}

/**
 * Create a chat
 */
export async function createChat(
  participantIds: string[],
  name?: string,
  token?: string
): Promise<any> {
  const client = getApiClient();
  const response = await client.post(
    '/api/chats',
    {
      participantIds,
      name,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
}

/**
 * Get user chats
 */
export async function getUserChats(token: string): Promise<any[]> {
  const client = getApiClient();
  const response = await client.get('/api/chats', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data || [];
}

/**
 * Get chat by ID
 */
export async function getChat(chatId: string, token: string): Promise<any> {
  const client = getApiClient();
  const response = await client.get(`/api/chats/${chatId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}

/**
 * Send a message in a chat
 */
export async function sendMessage(
  chatId: string,
  text: string,
  token: string
): Promise<any> {
  const client = getApiClient();
  const response = await client.post(
    `/api/chats/${chatId}/messages`,
    {
      text,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
}

/**
 * Get messages from a chat
 */
export async function getChatMessages(chatId: string, token: string): Promise<any[]> {
  const client = getApiClient();
  const response = await client.get(`/api/chats/${chatId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data || [];
}

/**
 * Get post by ID (via feed or search)
 */
export async function getPost(postId: string, token: string): Promise<any | null> {
  try {
    // Try to get from feed (might not be available)
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
    const post = posts.find((p: any) => p.id === postId);
    return post || null;
  } catch (error) {
    return null;
  }
}

/**
 * Retry helper for API calls
 */
export async function retryApiCall<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  
  throw lastError || new Error('API call failed after retries');
}

