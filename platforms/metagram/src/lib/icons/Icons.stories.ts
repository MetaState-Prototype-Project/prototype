import Icons from './Icons.svelte';

export default {
	title: 'UI/Icons',
	component: Icons,
	tags: ['autodocs'],
	decorators: [() => null],
	render: (args: Record<string, unknown>) => ({
		Component: Icons,
		props: args
	})
};

export const Default = {
	args: {}
};
