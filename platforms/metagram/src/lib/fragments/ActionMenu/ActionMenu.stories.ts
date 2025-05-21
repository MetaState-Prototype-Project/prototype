import type { ComponentProps } from 'svelte';
import { ActionMenu } from '..';

export default {
	title: 'UI/ActionMenu',
	component: ActionMenu,
	tags: ['autodocs'],
	render: (args: { Component: ActionMenu; props: ComponentProps<typeof ActionMenu> }) => ({
		Component: ActionMenu,
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
