import type { ComponentProps } from 'svelte';
import { Label } from '..';
import { LabelText } from './Label.stories.snippet.svelte';

export default {
	title: 'UI/Label',
	component: Label,
	tags: ['autodocs'],
	render: (args: { Component: Label; props: ComponentProps<typeof Label> }) => ({
		Component: Label,
		props: args
	})
};

export const Primary = {
	args: { children: LabelText }
};
