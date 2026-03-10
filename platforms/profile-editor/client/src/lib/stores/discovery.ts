import { writable } from 'svelte/store';
import { apiClient } from '$lib/utils/axios';

export interface ProfileSearchResult {
	id: string;
	ename: string;
	name: string;
	handle: string;
	headline: string;
	bio: string;
	location: string;
	skills: string[];
	avatarFileId: string | null;
	isVerified: boolean;
}

export interface SearchResponse {
	query: string;
	skills: string[] | null;
	results: ProfileSearchResult[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export const searchResults = writable<ProfileSearchResult[]>([]);
export const searchTotal = writable(0);
export const searchPage = writable(1);
export const searchTotalPages = writable(0);
export const searchLoading = writable(false);

export async function searchProfiles(
	query: string,
	options?: { skills?: string[]; page?: number; limit?: number }
): Promise<SearchResponse> {
	searchLoading.set(true);
	try {
		const params: Record<string, string> = { q: query };
		if (options?.skills?.length) params.skills = options.skills.join(',');
		if (options?.page) params.page = String(options.page);
		if (options?.limit) params.limit = String(options.limit);

		const response = await apiClient.get('/api/discover', { params });
		const data: SearchResponse = response.data;

		searchResults.set(data.results);
		searchTotal.set(data.total);
		searchPage.set(data.page);
		searchTotalPages.set(data.totalPages);

		return data;
	} finally {
		searchLoading.set(false);
	}
}
