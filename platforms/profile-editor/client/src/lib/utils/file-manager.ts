import { apiClient } from './axios';

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
	const base = apiClient.defaults.baseURL || 'http://localhost:3007';
	return `${base}/api/profiles/${encodeURIComponent(ename)}/${type}`;
}
