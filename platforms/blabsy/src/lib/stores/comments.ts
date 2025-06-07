import { writable } from 'svelte/store';
import { apiClient } from '$lib/utils/axios';

export interface Comment {
    id: string;
    text: string;
    createdAt: string;
    creator: {
        id: string;
        username: string;
        displayName: string;
        profilePictureUrl: string;
    };
}

export const comments = writable<Comment[]>([]);
export const isLoading = writable(false);
export const error = writable<string | null>(null);
export const activePostId = writable<string | null>();

export const fetchComments = async (blabId: string) => {
    try {
        isLoading.set(true);
        error.set(null);
        const response = await apiClient.get(`/api/blabs/${blabId}/replies`);
        comments.set(response.data);
    } catch (err) {
        error.set(err instanceof Error ? err.message : 'Failed to fetch replies');
    } finally {
        isLoading.set(false);
    }
};

export const createComment = async (blabId: string, text: string) => {
    try {
        isLoading.set(true);
        error.set(null);
        const response = await apiClient.post('/api/replies', { blabId, text });
        await fetchComments(blabId); // Refresh replies after creating
        return response.data;
    } catch (err) {
        error.set(err instanceof Error ? err.message : 'Failed to create reply');
        throw err;
    } finally {
        isLoading.set(false);
    }
};
