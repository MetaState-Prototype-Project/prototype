<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLLabelAttributes } from 'svelte/elements';

	interface ILabelProps extends HTMLLabelAttributes {
		children: Snippet;
	}

	let { children, ...restProps }: ILabelProps = $props();

	const cBase = 'inline-block text-lg font-geist font-medium text-black-800';
</script>

<label {...restProps} class={cn([cBase, restProps.class].join(' '))}>
	{@render children?.()}
</label>
