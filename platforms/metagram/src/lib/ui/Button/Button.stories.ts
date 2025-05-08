import type { ComponentProps } from 'svelte';
import { ButtonText } from './Button.stories.snippet.svelte';
import Button from './Button.svelte';

export default {
	title: 'UI/Button',
	component: Button,
	tags: ['autodocs'],
	render: (args: { Component: Button; props: ComponentProps<typeof Button> }) => ({
		Component: Button,
		props: args
	})
};

export const Primary = {
	args: { variant: 'primary', children: ButtonText }
};

export const Danger = {
	args: { variant: 'danger', children: ButtonText }
};

export const Loading = {
	args: { isLoading: true, children: ButtonText }
};

export const BlockingClick = {
	args: {
		blockingClick: true,
		children: ButtonText,
		callback: async () => {
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
};
