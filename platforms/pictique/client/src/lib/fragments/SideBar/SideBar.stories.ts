import type { ComponentProps } from 'svelte';
import { SideBar } from '..';

export default {
	title: 'UI/SideBar',
	component: SideBar,
	tags: ['autodocs'],
	render: (args: { Component: SideBar; props: ComponentProps<typeof SideBar> }) => ({
		Component: SideBar,
		props: args
	})
};

export const Primary = {
	args: {}
};
