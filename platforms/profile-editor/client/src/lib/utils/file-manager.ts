import { apiClient } from './axios';

export async function uploadFile(
	file: File,
	onProgress?: (progress: number) => void
): Promise<{ publicUrl: string; name: string; mimeType: string; size: number }> {
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

	// Backend uploads to eVault blob storage and returns a public CDN URL.
	return response.data;
}
