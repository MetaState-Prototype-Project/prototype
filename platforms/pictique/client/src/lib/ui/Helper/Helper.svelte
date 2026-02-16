<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IHelperProps extends HTMLAttributes<HTMLElement> {
		children: Snippet;
	}

	let { children, ...restProps }: IHelperProps = $props();

	const cBase = 'inline-block text-sm font-geist font-medium text-black-600';
</script>

<p {...restProps} class={cn([cBase, restProps.class].join(' '))}>
	{@render children?.()}
</p>
