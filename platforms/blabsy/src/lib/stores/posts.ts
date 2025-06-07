import { writable } from 'svelte/store';
import { apiClient } from '$lib/utils/axios';

export interface Post {
    id: string;
    content: string;
    images: string[];
    author: {
        id: string;
        username: string;
        displayName: string;
        profilePictureUrl: string;
    };
    createdAt: string;
    likedBy: string[];
    replies: {
        id: string;
        text: string;
        creator: {
            id: string;
            username: string;
            displayName: string;
            profilePictureUrl: string;
        };
        createdAt: string;
    }[];
}

export const posts = writable<Post[]>([]);
export const isLoading = writable(false);
export const error = writable<string | null>(null);
export const isCreatePostModalOpen = writable(false);

export const openCreatePostModal = () => isCreatePostModalOpen.set(true);
export const closeCreatePostModal = () => isCreatePostModalOpen.set(false);

export const fetchFeed = async (page = 1, limit = 10) => {
    try {
        isLoading.set(true);
        error.set(null);
        const response = await apiClient.get(`/api/blabs/feed?page=${page}&limit=${limit}`);
        posts.set(response.data);
    } catch (err) {
        error.set(err instanceof Error ? err.message : 'Failed to fetch feed');
    } finally {
        isLoading.set(false);
    }
};

export const createPost = async (content: string, images: string[]) => {
    try {
        isLoading.set(true);
        error.set(null);
        const response = await apiClient.post('/api/blabs', {
            content,
            images: images.map((img) => img)
        });
        await fetchFeed(1);
        return response.data;
    } catch (err) {
        error.set(err instanceof Error ? err.message : 'Failed to create blab');
        throw err;
    } finally {
        isLoading.set(false);
    }
};

export const toggleLike = async (blabId: string) => {
    try {
        const response = await apiClient.post(`/api/blabs/${blabId}/like`);
        return response.data;
    } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to toggle like');
    }
};
