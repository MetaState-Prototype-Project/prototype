<script lang="ts" generics="T">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { twMerge } from 'tailwind-merge';

	/** Specifies the type of the button. */
	interface IButtonProps extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'danger';
		isLoading?: boolean;
		loaderData?: T;
	}

	let {
		variant = 'primary',
		isLoading,
		loaderData = undefined,
		children = undefined,
		...restProps
	}: IButtonProps = $props();

	let commonClass =
		'w-full flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium border-[1px]';
	const primaryClass = twMerge(
		[commonClass, 'bg-primary-400 border-transparent text-white'].join(' ')
	);
	const secondaryClass = twMerge(
		[
			commonClass,
			'border-secondary-200 bg-white dark:bg-darker-background dark:border-secondary-500 text-primary-400'
		].join(' ')
	);
	const dangerClass = twMerge(
		[commonClass, 'border-transparent text-white bg-danger-400'].join(' ')
	);
	const disabledClass = twMerge(
		[commonClass, 'bg-secondary-500 cursor-not-allowed hover:bg-secondary-500'].join(' ')
	);
</script>

<button
	{...restProps}
	class={twMerge(
		[
			variant === 'primary' ? primaryClass : variant === 'secondary' ? secondaryClass : dangerClass,
			restProps.class,
			restProps.disabled ? disabledClass : ''
		].join(' ')
	)}
	disabled={isLoading || restProps.disabled}
>
	{@render children?.()}

	{#if isLoading}
			<div class="loader"></div>
	{/if}
</button>
