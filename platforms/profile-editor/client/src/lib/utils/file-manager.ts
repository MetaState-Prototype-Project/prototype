import { PUBLIC_PROFILE_EDITOR_BASE_URL } from '$env/static/public';
import { apiClient } from './axios';

const API_BASE = () => PUBLIC_PROFILE_EDITOR_BASE_URL || 'http://localhost:3006';

export async function uploadFile(
	file: File,
	onProgress?: (progress: number) => void
): Promise<{ id: string; name: string; mimeType: string; size: number }> {
	const formData = new FormData();
	formData.append('file', file);

	const response = await apiClient.post('/api/files', formData, {
		// Let the browser set Content-Type with the multipart boundary automatically.
		// Explicitly setting it strips the boundary and breaks multer parsing.
		headers: { 'Content-Type': undefined as unknown as string },
		onUploadProgress: (e) => {
			if (onProgress && e.total) {
				onProgress(Math.round((e.loaded * 100) / e.total));
			}
		}
	});

	return response.data;
}

export type ProfileAssetType = 'avatar' | 'banner' | 'cv' | 'video';

export function getProfileAssetUrl(ename: string, type: ProfileAssetType): string {
	return `${API_BASE()}/api/profiles/${encodeURIComponent(ename)}/${type}`;
}
