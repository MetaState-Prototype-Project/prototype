import { writable } from 'svelte/store';
import { apiClient } from '$lib/utils/axios';

export interface Comment {
	id: string;
	text: string;
	createdAt: string;
	author: {
		id: string;
		handle: string;
		name: string;
		avatarUrl: string;
	};
}

export const comments = writable<Comment[]>([]);
export const isLoading = writable(false);
export const error = writable<string | null>(null);
export const activePostId = writable<string | null>();

export const fetchComments = async (postId: string) => {
	try {
		isLoading.set(true);
		error.set(null);
		const response = await apiClient.get(`/api/posts/${postId}/comments`);
		comments.set(response.data);
	} catch (err) {
		error.set(err instanceof Error ? err.message : 'Failed to fetch comments');
	} finally {
		isLoading.set(false);
	}
};

export const createComment = async (postId: string, text: string) => {
	try {
		isLoading.set(true);
		error.set(null);
		const response = await apiClient.post('/api/comments', { postId, text });
		await fetchComments(postId); // Refresh comments after creating
		return response.data;
	} catch (err) {
		error.set(err instanceof Error ? err.message : 'Failed to create comment');
		throw err;
	} finally {
		isLoading.set(false);
	}
};
