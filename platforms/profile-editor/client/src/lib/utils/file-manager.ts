import { apiClient } from './axios';

export interface UploadedFile {
	id: string;
	name: string;
	mimeType: string;
	size: number;
	/** Present when the file was uploaded with `makePublic: true`. */
	publicUrl?: string;
}

export async function uploadFile(
	file: File,
	options: { onProgress?: (progress: number) => void; makePublic?: boolean } = {}
): Promise<UploadedFile> {
	const { onProgress, makePublic } = options;
	const formData = new FormData();
	formData.append('file', file);

	const response = await apiClient.post(
		`/api/files${makePublic ? '?public=true' : ''}`,
		formData,
		{
			// Let the browser set Content-Type with the multipart boundary automatically.
			// Explicitly setting it strips the boundary and breaks multer parsing.
			headers: { 'Content-Type': undefined as unknown as string },
			onUploadProgress: (e) => {
				if (onProgress && e.total) {
					onProgress(Math.round((e.loaded * 100) / e.total));
				}
			}
		}
	);

	return response.data;
}

export type ProfileAssetType = 'cv' | 'video';

/** For CV/video — gated assets served via the API proxy. */
export function getProfileAssetUrl(ename: string, type: ProfileAssetType): string {
	const base = apiClient.defaults.baseURL || 'http://localhost:3007';
	return `${base}/api/profiles/${encodeURIComponent(ename)}/${type}`;
}
