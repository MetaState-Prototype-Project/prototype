import type { ComponentProps } from 'svelte';
import { Drawer } from '..';

export default {
	title: 'UI/Drawer',
	component: Drawer,
	tags: ['autodocs'],
	render: (args: { Component: Drawer; props: ComponentProps<typeof Drawer> }) => ({
		Component: Drawer,
		props: args
	})
};

export const Main = {
	args: {}
};
