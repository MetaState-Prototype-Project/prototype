import type { ComponentProps } from 'svelte';
import { LiveDataFlow } from '..';

export default {
	title: 'UI/LiveDataFlow',
	component: LiveDataFlow,
	tags: ['autodocs'],
	render: (args: { Component: LiveDataFlow; props: ComponentProps<typeof LiveDataFlow> }) => ({
		Component: LiveDataFlow,
		props: args
	})
};

export const Default = {
	args: {}
};