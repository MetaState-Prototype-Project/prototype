import type { PostData } from '$lib/types';

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
