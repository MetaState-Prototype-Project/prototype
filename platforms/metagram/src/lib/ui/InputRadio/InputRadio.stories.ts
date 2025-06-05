import { InputRadio } from '..';

export default {
	title: 'UI/InputRadio',
	component: InputRadio,
	tags: ['autodocs'],
	render: (args: { type: string; placeholder: string }) => ({
		Component: InputRadio,
		props: args
	})
};

export const Radio = {
	args: {
		type: 'radio',
		value: 'option1',
		name: 'option-1'
	}
};
