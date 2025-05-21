import type { ComponentProps } from 'svelte';
import { ContextMenu } from '..';

export default {
	title: 'UI/ContextMenu',
	component: ContextMenu,
	tags: ['autodocs'],
	render: (args: { Component: ContextMenu; props: ComponentProps<typeof ContextMenu> }) => ({
		Component: ContextMenu,
		props: args
	})
};

export const Primary = {
	args: {
		options: [
			{ name: 'Report', handler: () => alert('report') },
			{ name: 'Clear chat', handler: () => alert('clear') }
		]
	}
};
