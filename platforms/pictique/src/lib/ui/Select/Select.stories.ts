import type { ComponentProps } from 'svelte';
import { Select } from '..';

export default {
	title: 'UI/Select',
	component: Select,
	tags: ['autodocs'],
	render: (args: { Component: Select; props: ComponentProps<typeof Select> }) => ({
		Component: Select,
		props: args
	})
};

export const Primary = {
	args: {}
};
