<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface IButtonProps extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'danger';
		isLoading?: boolean;
		callback?: () => Promise<void> | void;
		blockingClick?: boolean;
		type?: 'button' | 'submit' | 'reset';
		size?: 'sm' | 'md';
	}

	const {
		variant = 'primary',
		isLoading,
		callback,
		blockingClick,
		type = 'button',
		size = 'md',
		children = undefined,
		...restProps
	}: IButtonProps = $props();

	let isSubmitting = $state(false);
	const disabled = $derived(restProps.disabled || isLoading || isSubmitting);

	const handleClick = async () => {
		if (typeof callback !== 'function') return;

		if (blockingClick) isSubmitting = true;
		try {
			await callback();
		} catch (error) {
			console.error('Error in button callback:', error);
		} finally {
			isSubmitting = false;
		}
	};

	const variantClasses = {
		primary: {
			background: 'bg-grey',
			text: 'text-black-800',
			border: 'border border-black-400'
		},
		secondary: {
			background: 'bg-brand-burnt-orange',
			text: 'text-white',
			border: 'border border-brand-burnt-orange-700'
		},
		danger: { background: 'bg-red-500', text: 'text-white', border: 'border border-red-700' }
	};

	const disabledVariantClasses = {
		primary: {
			background: 'bg-grey/50',
			text: 'text-black-800/50',
			border: 'border border-black-400/50'
		},
		secondary: {
			background: 'bg-brand-burnt-orange/50',
			text: 'text-white/50',
			border: 'border border-brand-burnt-orange-700/50'
		},
		danger: {
			background: 'bg-red-500/50',
			text: 'text-white/50',
			border: 'border border-red-700/50'
		}
	};

	const sizeVariant = {
		sm: 'px-4 py-2.5 text-base h-11',
		md: 'px-8 py-2.5 text-xl h-14'
	};

	const classes = $derived({
		common: cn(
			'cursor-pointer w-full flex items-center justify-center rounded-full font-semibold duration-100',
			sizeVariant[size]
		),
		background: disabled
			? disabledVariantClasses[variant].background || variantClasses[variant].background
			: variantClasses[variant].background,
		text: disabled
			? disabledVariantClasses[variant].text || variantClasses[variant].text
			: variantClasses[variant].text,
		border: disabled
			? disabledVariantClasses[variant].border || variantClasses[variant].border
			: variantClasses[variant].border,
		disabled: 'cursor-not-allowed'
	});
</script>

<button
	{...restProps}
	class={cn(
		[
			classes.common,
			classes.background,
			classes.text,
			classes.border,
			disabled && classes.disabled,
			restProps.class
		].join(' ')
	)}
	{disabled}
	onclick={handleClick}
	{type}
>
	<div class="relative flex items-center justify-center">
		<div
			class="flex items-center justify-center duration-100"
			class:blur-xs={isLoading || isSubmitting}
		>
			{@render children?.()}
		</div>
		{#if isLoading || isSubmitting}
			<div
				class="border-black-800 absolute h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
			></div>
		{/if}
	</div>
</button>

<!--
    @component
    export default Button
    @description
    This component is a button with a loading spinner that can be used to indicate that an action is being performed.

    @props
    - variant: The variant of the button. Default is `primary`.
    - size: The size of the button. Default is `md`.
    - isLoading: A boolean to indicate if the button is in a loading state.
    - callback: A callback function that will be called when the button is clicked.
    - blockingClick: A boolean to indicate if the button should block the click event while the callback function is being executed.
    - icon: A slot for an icon to be displayed inside the button.
    - ...restProps: Any other props that can be passed to a button element.

    @usage
    ```html
    <script lang="ts">
        import * as Button from '$lib/ui/Button'
    </script>

    <Button.Action variant="primary" callback={() => console.log('clicked')}>
      Click me
    </Button.Action>
    ```
     -->
