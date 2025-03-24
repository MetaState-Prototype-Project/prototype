import Icons from './Icons.svelte';

export default {
	title: 'Icons',
	component: Icons,
	tags: ['autodocs'],
	decorators: [() => null],
	render: (args: any) => ({
		Component: Icons,
		props: args
	})
};

export const Default = {
	args: {}
};
