import { createTweet } from '../../utils/firebase-client';

export interface CreatedPost {
  id: string;
  text: string | null;
  createdBy: string;
}

/**
 * Create a post (tweet) on Blabsy
 */
export async function createPost(userId: string, text: string): Promise<CreatedPost> {
  const tweetId = await createTweet(userId, text);
  
  return {
    id: tweetId,
    text,
    createdBy: userId,
  };
}

