import { createComment as createCommentApi } from '../../utils/api-client';

export interface CreatedComment {
  id: string;
  text: string;
  authorId: string;
  postId: string;
}

/**
 * Create a comment on Pictique
 */
export async function createComment(
  token: string,
  postId: string,
  text: string
): Promise<CreatedComment> {
  const comment = await createCommentApi(postId, text, token);
  
  return {
    id: comment.id,
    text: comment.text,
    authorId: comment.author?.id || comment.author?.ename || '',
    postId: comment.postId || postId,
  };
}

