import type { ComponentProps } from 'svelte';
import Helper from './Helper.svelte';
import { HelperText } from './Helper.stories.snippet.svelte';

export default {
	title: 'UI/Helper',
	component: Helper,
	tags: ['autodocs'],
	render: (args: { Component: Helper; props: ComponentProps<typeof Helper> }) => ({
		Component: Helper,
		props: args
	})
};

export const Primary = {
	args: { children: HelperText }
};
