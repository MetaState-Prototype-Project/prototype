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
		required: true,
		disabled: false,
		name: 'email'
	}
};

export const Tel = {
	args: {
		type: 'tel',
		placeholder: '987654321',
		required: true,
		name: 'phone'
	}
};

export const isError = {
	args: {
		type: 'text',
		placeholder: 'Enter something',
		error: true,
		name: 'email'
	}
};

export const Textarea = {
	args: {
		type: 'textarea',
		placeholder: 'no :)',
		name: 'text'
	}
};

export const Email = {
	args: {
		type: 'email',
		placeholder: 'example@email.com',
		name: 'email'
	}
};

export const Password = {
	args: {
		type: 'password',
		name: 'password'
	}
};
