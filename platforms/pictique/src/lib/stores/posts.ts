import type { Post } from '$lib/types';
import { apiClient } from '$lib/utils/axios';
import { get, writable } from 'svelte/store';

export const posts = writable<Post[]>([]);
export const isLoading = writable(false);
export const isLoadingMore = writable(false);
export const error = writable<string | null>(null);
export const isCreatePostModalOpen = writable(false);
export const currentPage = writable(1);
export const hasMore = writable(true);

export const openCreatePostModal = () => isCreatePostModalOpen.set(true);
export const closeCreatePostModal = () => isCreatePostModalOpen.set(false);

export const resetFeed = () => {
	currentPage.set(1);
	hasMore.set(true);
	posts.set([]);
};

export const fetchFeed = async (page = 1, limit = 10, append = false) => {
	try {
		if (append) {
			isLoadingMore.set(true);
		} else {
			isLoading.set(true);
		}
		error.set(null);
		const response = await apiClient.get(`/api/posts/feed?page=${page}&limit=${limit}`);
		const responseData = response.data;

		// Handle both direct response and nested data structure
		const newPosts = responseData.posts || responseData.data?.posts || [];
		const responsePage = responseData.page || page;
		const total = responseData.total || 0;
		const totalPages = responseData.totalPages || Math.ceil(total / limit);

		if (append) {
			posts.update((existingPosts) => [...existingPosts, ...newPosts]);
		} else {
			posts.set(newPosts);
		}

		currentPage.set(responsePage);
		hasMore.set(newPosts.length === limit && responsePage < totalPages);
	} catch (err) {
		error.set(err instanceof Error ? err.message : 'Failed to fetch feed');
		hasMore.set(false);
	} finally {
		if (append) {
			isLoadingMore.set(false);
		} else {
			isLoading.set(false);
		}
	}
};

export const loadMoreFeed = async () => {
	const page = get(currentPage);
	const more = get(hasMore);
	const loading = get(isLoading) || get(isLoadingMore);

	if (!more || loading) {
		return;
	}

	await fetchFeed(page + 1, 10, true);
};

export const createPost = async (text: string, images: string[]) => {
	try {
		isLoading.set(true);
		error.set(null);
		
		const payload = {
			text,
			images: images.map((img) => img)
		};
		
		// Log payload size for debugging
		const payloadSize = new Blob([JSON.stringify(payload)]).size;
		console.log(`Payload size: ${(payloadSize / 1024).toFixed(2)} KB (${images.length} images)`);
		
		const response = await apiClient.post('/api/posts', payload);
		resetFeed();
		await fetchFeed(1, 10, false);
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
