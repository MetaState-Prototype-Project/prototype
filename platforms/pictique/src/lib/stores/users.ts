import { writable } from 'svelte/store';
import { apiClient } from '$lib/utils/axios';

export interface User {
	id: string;
	handle: string;
	name: string;
	description: string;
	avatarUrl: string;
	isVerified: boolean;
}

export const searchResults = writable<User[]>([]);
export const isSearching = writable(false);
export const searchError = writable<string | null>(null);

export const searchUsers = async (query: string) => {
	if (!query.trim()) {
		searchResults.set([]);
		return;
	}

	try {
		isSearching.set(true);
		searchError.set(null);
		const response = await apiClient.get(`/api/users/search?q=${encodeURIComponent(query)}`);
		searchResults.set(response.data);
	} catch (err) {
		searchError.set(err instanceof Error ? err.message : 'Failed to search users');
		searchResults.set([]);
	} finally {
		isSearching.set(false);
	}
};

export const followUser = async (followingId: string) => {
	try {
		await apiClient.post('/api/users/follow', { followingId });
		return true;
	} catch (err) {
		console.error('Failed to follow user:', err);
		return false;
	}
};
