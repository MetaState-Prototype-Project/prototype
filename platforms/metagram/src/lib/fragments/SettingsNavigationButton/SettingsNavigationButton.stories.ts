import type { ComponentProps } from 'svelte';
import { SettingsNavigationButton } from '..';
import { ButtonIcon, ButtonText } from './SettingsNavigationButton.stories.snippet.svelte';

export default {
	title: 'UI/SettingsNavigationButton',
	component: SettingsNavigationButton,
	tags: ['autodocs'],
	render: (args: {
		Component: SettingsNavigationButton;
		props: ComponentProps<typeof SettingsNavigationButton>;
	}) => ({
		Component: SettingsNavigationButton,
		props: args
	})
};

export const Primary = {
	args: {
		children: ButtonText,
		leadingIcon: ButtonIcon,
		onclick: () => alert('clicked'),
		hasTrailingIcon: true
	}
};

export const Secondary = {
	args: {
		children: ButtonText,
		leadingIcon: ButtonIcon,
		onclick: () => alert('clicked'),
		hasTrailingIcon: false
	}
};
