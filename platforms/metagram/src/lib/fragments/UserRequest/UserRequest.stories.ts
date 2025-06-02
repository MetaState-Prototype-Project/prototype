import type { ComponentProps } from 'svelte';
import {UserRequest} from '..';

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
		
	}
};