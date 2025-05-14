<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface IInputProps extends HTMLInputAttributes {
		type: 'text' | 'number' | 'email' | 'tel' | 'password';
		value: string | number;
		placeholder: string;
		isRequired: boolean;
		isDisabled: boolean;
		isError: boolean;
	}

	let {
		type = 'text',
		value = $bindable(),
		placeholder = '',
		isRequired = false,
		isDisabled = false,
		isError = false,
		...restProps
	}: IInputProps = $props();

	const cbase = $derived(
		`w-full bg-grey py-3.5 px-6 text-[15px] text-black-800 font-geist font-normal placeholder:text-black-600 rounded-4xl outline-0 border border-transparent ${isError && 'border border-red text-red focus:text-black-800 focus:border-transparent'} ${isDisabled && 'cursor-not-allowed'}`
	);
</script>

<input
	{...restProps}
	{type}
	{placeholder}
	bind:value
	required={isRequired}
	disabled={isDisabled}
	class={cn([cbase, restProps.class].join(' '))}
	tabindex="0"
/>
