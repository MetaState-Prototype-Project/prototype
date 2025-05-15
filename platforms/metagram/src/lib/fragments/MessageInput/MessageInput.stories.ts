import type { ComponentProps } from 'svelte';
import MessageInput from './MessageInput.svelte';

export default {
	title: 'UI/MessageInput',
	component: MessageInput,
	tags: ['autodocs'],
	render: (args: { Component: MessageInput; props: ComponentProps<typeof MessageInput> }) => ({
		Component: MessageInput,
		props: args
	})
};

export const Primary = {
	args: {}
};
