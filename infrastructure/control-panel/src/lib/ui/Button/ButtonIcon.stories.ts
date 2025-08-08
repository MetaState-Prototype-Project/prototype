import { FlashlightIcon, ViewIcon } from '@hugeicons/core-free-icons';
import type { ComponentProps } from 'svelte';
import ButtonIcon from './ButtonIcon.svelte';

export default {
	title: 'UI/ButtonIcon',
	component: ButtonIcon,
	tags: ['autodocs'],
	render: (args: ComponentProps<typeof ButtonIcon>) => ({
		Component: ButtonIcon,
		props: args
	})
};

export const Default = {
	render: () => ({
		Component: ButtonIcon,
		props: {
			ariaLabel: 'Default button',
			bgSize: 'md', // Predefined size
			iconSize: 'md',
			icon: ViewIcon,
			bgColor: 'black',
			iconColor: 'white'
		}
	})
};

export const CustomSize = {
	render: () => ({
		Component: ButtonIcon,
		props: {
			ariaLabel: 'Custom sized button',
			bgSize: 'w-[120px] h-[120px]', // Custom Tailwind size
			iconSize: 56, // Custom pixel size
			icon: FlashlightIcon,
			bgColor: 'bg-danger',
			iconColor: 'white'
		}
	})
};

export const Loading = {
	render: () => ({
		Component: ButtonIcon,
		props: {
			ariaLabel: 'Loading button',
			bgSize: 'md',
			iconSize: 'md',
			icon: FlashlightIcon,
			isLoading: true,
			bgColor: 'black',
			iconColor: 'white'
		}
	})
};

export const WithCallback = {
	render: () => ({
		Component: ButtonIcon,
		props: {
			ariaLabel: 'Button with async callback',
			bgSize: 'md',
			iconSize: 'md',
			icon: FlashlightIcon,
			callback: async () => {
				await new Promise((resolve) => setTimeout(resolve, 2000));
				console.log('Action completed!');
			},
			blockingClick: true,
			bgColor: 'primary',
			iconColor: 'white'
		}
	})
};
