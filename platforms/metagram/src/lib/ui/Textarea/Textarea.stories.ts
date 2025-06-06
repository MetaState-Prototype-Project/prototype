import { Textarea } from '..';

export default {
	title: 'UI/Textarea',
	component: Textarea,
	tags: ['autodocs'],
	render: (args: { type: string; placeholder: string }) => ({
		Component: Textarea,
		props: args
	})
};

export const Main = {
	args: {
		placeholder: 'Joe Biden'
	}
};
