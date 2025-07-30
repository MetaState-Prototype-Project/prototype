import type { Post } from '$lib/types';
import { apiClient } from '$lib/utils/axios';
import { writable } from 'svelte/store';

export const posts = writable<Post[]>([]);
export const isLoading = writable(false);
export const error = writable<string | null>(null);
export const isCreatePostModalOpen = writable(false);

export const openCreatePostModal = () => isCreatePostModalOpen.set(true);
export const closeCreatePostModal = () => isCreatePostModalOpen.set(false);

export const fetchFeed = async (page = 1, limit = 10_000) => {
	try {
		isLoading.set(true);
		error.set(null);
		const response = await apiClient.get(`/api/posts/feed?page=${page}&limit=${limit}`);
		posts.set(response.data);
	} catch (err) {
		error.set(err instanceof Error ? err.message : 'Failed to fetch feed');
	} finally {
		isLoading.set(false);
	}
};

export const createPost = async (text: string, images: string[]) => {
	try {
		isLoading.set(true);
		error.set(null);
		const response = await apiClient.post('/api/posts', {
			text,
			images: images.map((img) => img)
		});
		await fetchFeed(1);
		return response.data;
	} catch (err) {
		error.set(err instanceof Error ? err.message : 'Failed to create post');
		throw err;
	} finally {
		isLoading.set(false);
	}
};

export const toggleLike = async (postId: string) => {
	try {
		const response = await apiClient.post(`/api/posts/${postId}/like`);
		return response.data;
	} catch (err) {
		throw new Error(err instanceof Error ? err.message : 'Failed to toggle like');
	}
};
