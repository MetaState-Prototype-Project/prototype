import type { ComponentProps } from 'svelte';
import Checkbox from './Checkbox.svelte';

export default {
	title: 'UI/Checkbox',
	component: Checkbox,
	tags: ['autodocs'],
	render: (args: { Component: Checkbox; props: ComponentProps<typeof Checkbox> }) => ({
		Component: Checkbox,
		props: args
	})
};

export const Basic = {
	args: {}
};

export const Disabled = {
	args: { disabled: true }
};
