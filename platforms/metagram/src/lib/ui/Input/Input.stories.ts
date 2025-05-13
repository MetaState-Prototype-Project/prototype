import { Input } from '..';

export default {
	title: 'UI/Input',
	component: Input,
	tags: ['autodocs'],
	render: (args: { type: string; placeholder: string; helperText: string }) => ({
		Component: Input,
		props: args
	})
};

export const Text = {
	args: {
		type: 'text',
		placeholder: 'Joe Biden',
		isRequired: true,
		isDisabled: true
	}
};

export const Tel = {
	args: {
		type: 'tel',
		placeholder: '987654321',
		isRequired: true
	}
};

export const isError = {
	args: {
		type: 'text',
		placeholder: 'Enter something',
		isError: true
	}
};

export const Textarea = {
	args: {
		type: 'textarea',
		placeholder: 'no :)'
	}
};

export const Email = {
	args: {
		type: 'email',
		placeholder: 'example@email.com'
	}
};

export const Password = {
	args: {
		type: 'password'
	}
};
