import type { ComponentProps } from 'svelte';
import { BottomNav } from '..';

export default {
	title: 'UI/BottomNav',
	component: BottomNav,
	tags: ['autodocs'],
	render: (args: { Component: BottomNav; props: ComponentProps<typeof BottomNav> }) => ({
		Component: BottomNav,
		props: args
	})
};

export const Primary = {
	args: {}
};
