<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	interface IInputProps extends HTMLTextareaAttributes {
		textarea?: HTMLTextAreaElement;
		value: string | number | any;
		placeholder?: string;
	}

	let {
		textarea = $bindable(),
		value = $bindable(),
		placeholder = '',
		...restProps
	}: IInputProps = $props();

	const cbase = $derived(
		'w-full bg-grey resize-none py-3.5 px-6 text-[15px] text-black-800 font-geist font-normal placeholder:text-black-600 rounded-4xl outline-0 border border-transparent invalid:border-red invalid:text-red focus:invalid:text-black-800 focus:invalid:border-transparent'
	);
</script>

<!-- svelte-ignore element_invalid_self_closing_tag -->
<textarea
	{...restProps}
	rows={6}
	{placeholder}
	bind:value
	bind:this={textarea}
	class={cn([cbase, restProps.class].join(' '))}
	tabindex="0"
/>
