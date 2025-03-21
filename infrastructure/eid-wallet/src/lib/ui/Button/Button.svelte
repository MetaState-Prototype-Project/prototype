<script lang="ts" generics="T">
    import { cn } from '$lib/utils'
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface IButtonProps extends HTMLButtonAttributes {
		variant?: 'solid' | 'soft' | 'danger' | 'danger-soft';
		isLoading?: boolean;
	}

	let {
		variant = 'solid',
		isLoading,
		children = undefined,
		...restProps
	}: IButtonProps = $props();

	let disabled = restProps.disabled || isLoading;

	const variantClasses = {
    solid: { background: 'bg-primary-900', text: 'text-white' },
    soft: { background: 'bg-primary-100', text: 'text-primary-900' },
    danger: { background: 'bg-danger-500', text: 'text-white' },
    'danger-soft': { background: 'bg-danger-300', text: 'text-danger-500' }
  };

  const disabledVariantClasses = {
    solid: { background: 'bg-primary-500', text: 'text-white' },
	soft: { background: 'bg-primary-100', text: 'text-primary-500' },
	danger: { background: 'bg-danger-500', text: 'text-white' },
	'danger-soft': { background: 'bg-danger-300', text: 'text-danger-500' }
  };

  let classes = {
    common: 'flex items-center justify-center px-8 py-2.5 rounded-full text-xl font-semibold h-[56px]',
    background: disabled ? disabledVariantClasses[variant].background || variantClasses[variant].background : variantClasses[variant].background,
    text: disabled ? disabledVariantClasses[variant].text || variantClasses[variant].text : variantClasses[variant].text,
    disabled: 'cursor-not-allowed'
  };
</script>

<button
	{...restProps}
	class={cn(
		[
			restProps.class,
			classes.common,
			classes.background,
			classes.text,
			disabled && classes.disabled
		].join(' ')
	)}
	disabled={isLoading || restProps.disabled}
>
	{@render children?.()}
<div class="py-2.5 text-xl font- leadin."></div>
	{#if isLoading}
			<div class="loader"></div>
	{/if}
</button>
