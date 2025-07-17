import type { Image, PostData } from '$lib/types';

export const isNavigatingThroughNav = $state({
	value: false
});

export const showComments = $state({
	value: false
});

export const ownerId = $state({
	value: '1'
});

export const selectedPost: { value: PostData | null } = $state({
	value: null
});

export const uploadedImages: { value: Image[] | null } = $state({
	value: null
});

export const audience: { value: string } = $state({
	value: 'Everyone'
});
