import type { Image } from '$lib/types';

export const revokeImageUrls = (imageArray: Image[]) => {
	if (imageArray) {
		for (const img of imageArray) {
			URL.revokeObjectURL(img.url);
		}
	}
};
