import type { ComponentProps } from 'svelte';
import { UserRequest } from '..';

export default {
	title: 'UI/UserRequest',
	component: UserRequest,
	tags: ['autodocs'],
	render: (args: { Component: UserRequest; props: ComponentProps<typeof UserRequest> }) => ({
		Component: UserRequest,
		props: args
	})
};

export const Primary = {
	args: {
		userImgSrc: 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
		userName: 'luffythethird',
		description:
			'I’ve always wished life came at me fast. Funny how that wish never came through',
		handleFollow: () => alert('Adsad')
	}
};
