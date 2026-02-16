<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface ITextareaProps extends HTMLAttributes<HTMLTextAreaElement> {
		name?: string;
		placeholder?: string;
		value: string;
		rows?: number;
	}

	let {
		name = '',
		placeholder = '',
		value = $bindable(),
		rows,
		...restProps
	}: ITextareaProps = $props();

	const cBase = 'rounded-xl bg-grey/80 resize-none w-full p-5';
</script>

<textarea
	{...restProps}
	{rows}
	{name}
	id={name}
	bind:value
	{placeholder}
	class={cn([cBase, restProps.class].join(' '))}
></textarea>
