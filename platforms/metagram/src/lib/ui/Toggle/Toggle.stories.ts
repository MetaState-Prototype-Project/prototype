import type { ComponentProps } from 'svelte';
import Toggle from './Toggle.svelte';

export default {
	title: 'UI/Toggle',
	component: Toggle,
	tags: ['autodocs'],
	render: (args: { Component: Toggle; props: ComponentProps<typeof Toggle> }) => ({
		Component: Toggle,
		props: args
	})
};

export const Primary = {
	args: {}
};
