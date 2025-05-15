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

export const Comment = {
	args: {
		variant: 'comment',
		placeholder: 'Write your comment',
		handleSend: () => alert('sent')
	}
};

export const Dm = {
	args: {
		variant: 'dm',
		placeholder: 'Write your message',
		handleAdd: () => alert('add'),
		handleSend: () => alert('sent')
	}
};
