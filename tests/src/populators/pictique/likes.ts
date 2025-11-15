import { toggleLike as toggleLikeApi } from '../../utils/api-client';

export interface CreatedLike {
  userId: string;
  postId: string;
  isLiked: boolean;
}

/**
 * Create a like on Pictique
 */
export async function createLike(token: string, postId: string, userId: string): Promise<CreatedLike> {
  await toggleLikeApi(postId, token);
  
  return {
    userId,
    postId,
    isLiked: true,
  };
}

