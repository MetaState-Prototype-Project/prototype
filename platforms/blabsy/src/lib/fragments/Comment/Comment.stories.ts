import type { ComponentProps } from 'svelte';
import { Comment } from '..';
import { comments } from '$lib/dummyData';

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
		comment: comments[0]
	}
};
