<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';

	interface IInputProps extends HTMLInputAttributes {
		type: HTMLInputTypeAttribute;
		selected?: string;
		name?: string;
		input?: HTMLInputElement;
		value: string | number | any;
		placeholder?: string;
	}

	let {
		type = 'text',
		input = $bindable(),
		value = $bindable(),
		selected = $bindable(),
		name = '',
		placeholder = '',
		...restProps
	}: IInputProps = $props();

	let radioElement: HTMLInputElement | null = $state(null);

	const typeClasses: Record<string, string> = {
		radio: 'opacity-100'
	};

	const cbase = $derived({
		common: 'w-full bg-grey py-3.5 px-6 text-[15px] text-black-800 font-geist font-normal placeholder:text-black-600 rounded-4xl outline-0 border border-transparent invalid:border-red invalid:text-red focus:invalid:text-black-800 focus:invalid:border-transparent',
		type: typeClasses[type]
	});

	const radioCustomStyles = $derived({
		common: "before:h-4.5 before:w-4.5 before:border-brand-burnt-orange before:-left-0.75 before:-bottom-0.25 relative before:absolute before:rounded-full before:border-2 before:bg-white before:content-['']",
		selected:
			'after:h-2.5 after:w-2.5 after:bg-brand-burnt-orange after:absolute after:bottom-0.75 after:left-0.25 after:rounded-full'
	});
</script>

{#if type === 'radio'}
	<div
		class={cn(
			[radioCustomStyles.common, selected === value ? radioCustomStyles.selected : ''].join(
				' '
			)
		)}
		aria-checked={selected === value}
		role="radio"
		tabindex="0"
		onclick={() => radioElement?.click()}
		onkeypress={() => radioElement?.click()}
	>
		<input
			{...restProps}
			type="radio"
			{value}
			bind:group={selected}
			bind:this={radioElement}
			{name}
			checked={selected === value}
			class={cn([cbase.common, cbase.type, restProps.class].join(' '))}
			tabindex="0"
		/>
	</div>
{:else}
	<input
		{...restProps}
		{type}
		{placeholder}
		bind:this={input}
		bind:value
		class={cn([cbase.common, cbase.type, restProps.class].join(' '))}
		tabindex="0"
	/>
{/if}
