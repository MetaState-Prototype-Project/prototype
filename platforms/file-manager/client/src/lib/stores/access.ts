import { writable } from 'svelte/store';
import { apiClient } from '$lib/utils/axios';

export const fileAccess = writable<any[]>([]);
export const folderAccess = writable<any[]>([]);
export const isLoading = writable(false);

export interface FileAccess {
	id: string;
	fileId: string;
	userId: string;
	user: {
		id: string;
		name: string;
		ename: string;
		avatarUrl: string;
	} | null;
	grantedBy: string;
	granter: {
		id: string;
		name: string;
		ename: string;
	} | null;
	permission: 'view';
	createdAt: string;
}

export interface FolderAccess {
	id: string;
	folderId: string;
	userId: string;
	user: {
		id: string;
		name: string;
		ename: string;
		avatarUrl: string;
	} | null;
	grantedBy: string;
	granter: {
		id: string;
		name: string;
		ename: string;
	} | null;
	permission: 'view';
	createdAt: string;
}

export const fetchFileAccess = async (fileId: string) => {
	try {
		isLoading.set(true);
		const response = await apiClient.get(`/api/files/${fileId}/access`);
		fileAccess.set(response.data || []);
	} catch (error) {
		console.error('Failed to fetch file access:', error);
		fileAccess.set([]);
	} finally {
		isLoading.set(false);
	}
};

export const fetchFolderAccess = async (folderId: string) => {
	try {
		isLoading.set(true);
		const response = await apiClient.get(`/api/folders/${folderId}/access`);
		folderAccess.set(response.data || []);
	} catch (error) {
		console.error('Failed to fetch folder access:', error);
		folderAccess.set([]);
	} finally {
		isLoading.set(false);
	}
};

export const grantFileAccess = async (fileId: string, userId: string): Promise<FileAccess> => {
	const response = await apiClient.post(`/api/files/${fileId}/access`, {
		userId,
		permission: 'view',
	});

	const newAccess = response.data;
	fileAccess.update(access => [...access, newAccess]);
	return newAccess;
};

export const revokeFileAccess = async (fileId: string, userId: string): Promise<void> => {
	await apiClient.delete(`/api/files/${fileId}/access/${userId}`);
	fileAccess.update(access => access.filter(a => !(a.fileId === fileId && a.userId === userId)));
};

export const grantFolderAccess = async (folderId: string, userId: string): Promise<FolderAccess> => {
	const response = await apiClient.post(`/api/folders/${folderId}/access`, {
		userId,
		permission: 'view',
	});

	const newAccess = response.data;
	folderAccess.update(access => [...access, newAccess]);
	return newAccess;
};

export const revokeFolderAccess = async (folderId: string, userId: string): Promise<void> => {
	await apiClient.delete(`/api/folders/${folderId}/access/${userId}`);
	folderAccess.update(access => access.filter(a => !(a.folderId === folderId && a.userId === userId)));
};

