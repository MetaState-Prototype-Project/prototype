import type { ComponentProps } from 'svelte';
import { Comment } from '..';

export default {
	title: 'UI/Comment',
	component: Comment,
	tags: ['autodocs'],
	render: (args: { Component: Comment; props: ComponentProps<typeof Comment> }) => ({
		Component: Comment,
		props: args
	})
};

export const Main = {
	args: {
		name: 'LuffyTHeTHird',
		comment:
			'i was thinking of making it to the conference so we could take some more fire pictures like last time',
		likeCount: 0,
		handleReply: () => alert('reply'),
		time: '3 minutes ago',
		isLiked: false,
		isDisliked: false
	}
};
