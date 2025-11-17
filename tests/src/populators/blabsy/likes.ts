import { toggleLike } from '../../utils/firebase-client';

export interface CreatedLike {
  userId: string;
  tweetId: string;
  isLiked: boolean;
}

/**
 * Create a like on Blabsy
 */
export async function createLike(userId: string, tweetId: string): Promise<CreatedLike> {
  await toggleLike(userId, tweetId, true);
  
  return {
    userId,
    tweetId,
    isLiked: true,
  };
}

