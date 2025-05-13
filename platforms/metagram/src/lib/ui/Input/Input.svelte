<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface IInputProps extends HTMLInputAttributes {
		type: 'text' | 'number' | 'email' | '';
		value: string | number;
		placeholder: string;
		isRequired: boolean;
		isDisabled: boolean;
	}

	let {
		type = 'text',
		value = $bindable(),
		placeholder = '',
		isRequired = false,
		isDisabled = false,
		...restProps
	}: IInputProps = $props();

	const cbase =
		'w-full bg-grey py-3.5 px-6 text-[15px] text-black-800 placeholder:text-black-600 rounded-4xl';
</script>

<input
	{...restProps}
	{type}
	{placeholder}
	required={isRequired}
	class={cn([cbase, restProps.class].join(' '))}
/>
