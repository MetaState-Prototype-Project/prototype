import type { ComponentProps } from 'svelte';
import Logs from './Logs.svelte';

export default {
	title: 'UI/Logs',
	component: Logs,
	tags: ['autodocs'],
	render: (args: { Component: Logs; props: ComponentProps<typeof Logs> }) => ({
		Component: Logs,
		props: args
	})
};

export const Default = {
	args: {
		events: [
			{
				timestamp: new Date(),
				action: 'upload',
				message: 'msg_123',
				to: 'alice.vault.dev'
			},
			{
				timestamp: new Date(),
				action: 'fetch',
				message: 'msg_124',
				from: 'bob.vault.dev'
			},
			{
				timestamp: new Date(),
				action: 'webhook',
				to: 'Alice',
				from: 'Pic'
			}
		]
	}
};
