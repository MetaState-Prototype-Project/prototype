import type { ComponentProps } from 'svelte';
import Message from './Message.svelte';

export default {
	title: 'UI/Message',
	component: Message,
	tags: ['autodocs'],
	render: (args: { Component: Message; props: ComponentProps<typeof Message> }) => ({
		Component: Message,
		props: args
	})
};

export const Primary = {
	args: {
		avatar: 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
		username: 'donaldthefirstt',
		text: 'i was thinking of making it to the conference so we could take some more fire pictures like last time',
		unread: false,
		callback: () => alert('Message clicked')
	}
};

export const Unread = {
	args: {
		avatar: 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
		username: 'donaldthefirstt',
		text: 'i was thinking of making it to the conference so we could take some more fire pictures like last time',
		unread: true,
		callback: () => alert('Message clicked')
	}
};
