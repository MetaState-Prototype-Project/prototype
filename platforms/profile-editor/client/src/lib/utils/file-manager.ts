import { PUBLIC_FILE_MANAGER_BASE_URL } from '$env/static/public';
import { apiClient } from './axios';

const DEFAULT_FILE_MANAGER_BASE_URL = 'https://file-manager.w3ds.metastate.foundation';

export function isHttpUrl(value?: string | null): boolean {
	return !!value && /^(https?:)?\/\//i.test(value);
}

/**
 * Resolve a stored profile asset (avatar/banner/cv/video) to a renderable URL.
 * New uploads store a public eVault-blob URL and are used as-is. Legacy
 * profiles stored a bare file-manager id — resolve it against the configured
 * file-manager (defaulting to the public deployment) so the old asset renders.
 */
export function resolveAssetUrl(value?: string | null): string | null {
	if (!value) return null;
	if (isHttpUrl(value)) return value;
	const base = (PUBLIC_FILE_MANAGER_BASE_URL || DEFAULT_FILE_MANAGER_BASE_URL).replace(
		/\/$/,
		''
	);
	return `${base}/api/public/files/${encodeURIComponent(value)}`;
}

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
