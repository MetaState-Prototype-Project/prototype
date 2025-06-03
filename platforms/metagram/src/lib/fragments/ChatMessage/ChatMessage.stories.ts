import type { ComponentProps } from 'svelte';
import { ChatMessage } from '..';

export default {
	title: 'UI/ChatMessage',
	component: ChatMessage,
	tags: ['autodocs'],
	render: (args: { Component: ChatMessage; props: ComponentProps<typeof ChatMessage> }) => ({
		Component: ChatMessage,
		props: args
	})
};

export const Outgoing = {
	args: {
		isOwn: true
	}
};

export const Incoming = {
	args: {
		isOwn: false,
		message:
			'Lorem ipsum dolor sit amet consectetur adipisicing elit. Sed voluptatem accusantium voluptas vel, libero minus veniam at! Doloribus autem, id, ipsum laudantium dolor blanditiis nulla eum eveniet illo perspiciatis iusto.Voluptas ea pariatur eveniet quidem incidunt vitae sunt, hic labore nisi officiis consectetur autem odio repellendus nesciunt quisquam alias consequatur corrupti quaerat, minus qui. Obcaecati deleniti optio quod quibusdam placeat.'
	}
};

export const OutgoingWithoutHead = {
	args: {
		isOwn: true,
		isHeadNeeded: false
	}
};

export const WithoutHead = {
	args: {
		isOwn: false,
		isHeadNeeded: false,
		message:
			'Lorem ipsum dolor sit amet consectetur adipisicing elit. Sed voluptatem accusantium voluptas vel, libero minus veniam at! Doloribus autem, id, ipsum laudantium dolor blanditiis nulla eum eveniet illo perspiciatis iusto.Voluptas ea pariatur eveniet quidem incidunt vitae sunt, hic labore nisi officiis consectetur autem odio repellendus nesciunt quisquam alias consequatur corrupti quaerat, minus qui. Obcaecati deleniti optio quod quibusdam placeat.'
	}
};
