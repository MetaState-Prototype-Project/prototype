import { createPost as createPostApi } from '../../utils/api-client';

export interface CreatedPost {
    id: string;
    text: string;
    authorId: string;
}

/**
 * Create a post on Pictique
 */
export async function createPost(token: string, text: string): Promise<CreatedPost> {
    const post = await createPostApi({ text }, token);

    return {
        id: post.id,
        text: post.text,
        authorId: post.author?.id || post.author?.ename || '',
    };
}

