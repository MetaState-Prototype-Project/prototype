<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';

	interface IInputProps extends HTMLInputAttributes {
		type: HTMLInputTypeAttribute;
	}

	let {
		type = 'text',
		value = $bindable(),
		placeholder = '',
		...restProps
	}: IInputProps = $props();

	const cbase = $derived(
		'w-full bg-grey py-3.5 px-6 text-[15px] text-black-800 font-geist font-normal placeholder:text-black-600 rounded-4xl outline-0 border border-transparent invalid:border-red invalid:text-red focus:invalid:text-black-800 focus:invalid:border-transparent'
	);
</script>

<input
	{...restProps}
	{type}
	{placeholder}
	bind:value
	class={cn([cbase, restProps.class].join(' '))}
	tabindex="0"
/>
