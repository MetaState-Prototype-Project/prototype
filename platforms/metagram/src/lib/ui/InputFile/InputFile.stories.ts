import { InputFile } from '..';

export default {
	title: 'UI/InputFile',
	component: InputFile,
	tags: ['autodocs'],
	render: (args: { type: string; placeholder: string; helperText: string }) => ({
		Component: InputFile,
		props: args
	})
};

export const Main = {
	args: {}
};
