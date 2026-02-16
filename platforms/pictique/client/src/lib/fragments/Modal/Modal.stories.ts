import type { ComponentProps } from 'svelte';
import { Modal } from '..';
import { ModalContent } from './Modal.stories.snippet.svelte';

export default {
	title: 'UI/Modal',
	component: Modal,
	tags: ['autodocs'],
	render: (args: { Component: Modal; props: ComponentProps<typeof Modal> }) => ({
		Component: Modal,
		props: args
	})
};

export const Main = {
	args: {
		children: ModalContent
	}
};
