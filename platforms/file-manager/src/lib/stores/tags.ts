import { writable } from 'svelte/store';
import { apiClient } from '$lib/utils/axios';

export const tags = writable<any[]>([]);
export const isLoading = writable(false);

export interface Tag {
	id: string;
	name: string;
	color: string | null;
	ownerId: string;
	createdAt: string;
}

export const fetchTags = async () => {
	try {
		isLoading.set(true);
		const response = await apiClient.get('/api/tags');
		tags.set(response.data || []);
	} catch (error) {
		console.error('Failed to fetch tags:', error);
		tags.set([]);
	} finally {
		isLoading.set(false);
	}
};

export const createTag = async (name: string, color?: string | null): Promise<Tag> => {
	const response = await apiClient.post('/api/tags', { name, color: color || null });
	const newTag = response.data;
	tags.update(tags => [newTag, ...tags]);
	return newTag;
};

export const updateTag = async (
	tagId: string,
	name?: string,
	color?: string | null
): Promise<Tag> => {
	const response = await apiClient.patch(`/api/tags/${tagId}`, {
		name,
		color: color !== undefined ? (color || null) : undefined,
	});

	const updatedTag = response.data;
	tags.update(tags => tags.map(t => t.id === tagId ? updatedTag : t));
	return updatedTag;
};

export const deleteTag = async (tagId: string): Promise<void> => {
	await apiClient.delete(`/api/tags/${tagId}`);
	tags.update(tags => tags.filter(t => t.id !== tagId));
};

export const addTagToFile = async (fileId: string, tagId: string): Promise<void> => {
	await apiClient.post(`/api/files/${fileId}/tags`, { tagId });
};

export const removeTagFromFile = async (fileId: string, tagId: string): Promise<void> => {
	await apiClient.delete(`/api/files/${fileId}/tags/${tagId}`);
};

export const addTagToFolder = async (folderId: string, tagId: string): Promise<void> => {
	await apiClient.post(`/api/folders/${folderId}/tags`, { tagId });
};

export const removeTagFromFolder = async (folderId: string, tagId: string): Promise<void> => {
	await apiClient.delete(`/api/folders/${folderId}/tags/${tagId}`);
};

