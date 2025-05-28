<script lang="ts">
	import { cn } from '$lib/utils';
	import { Delete02Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface ISettingsDeleteButtonProps extends HTMLAttributes<HTMLElement> {
		children: Snippet;
		onclick: () => void;
	}

	let { children, onclick, ...restProps }: ISettingsDeleteButtonProps = $props();

	const cBase = 'flex w-full items-center justify-between';
</script>

<div {...restProps} class={cn([cBase, restProps.class].join(' '))}>
	<div class="flex items-center gap-2">
		<h3 class="text-black-800 text-base">
			{@render children?.()}
		</h3>
	</div>
	<button class="cursor-pointer" {onclick}>
		<HugeiconsIcon icon={Delete02Icon} color="var(--color-black-400)" />
	</button>
</div>
