import { createReply } from '../../utils/firebase-client';

export interface CreatedComment {
  id: string;
  text: string;
  createdBy: string;
  parentId: string;
}

/**
 * Create a comment (reply) on Blabsy
 */
export async function createComment(
  userId: string,
  parentTweetId: string,
  text: string
): Promise<CreatedComment> {
  const replyId = await createReply(userId, parentTweetId, text);
  
  return {
    id: replyId,
    text,
    createdBy: userId,
    parentId: parentTweetId,
  };
}

