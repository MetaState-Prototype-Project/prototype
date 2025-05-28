<script lang="ts">
	import { Toggle } from '$lib/ui';
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface ISettingsToggleButtonProps extends HTMLButtonAttributes {
		children: Snippet;
		checked: boolean;
	}

	let { children, onclick, checked, ...restProps }: ISettingsToggleButtonProps = $props();

	const cBase = 'flex w-full items-center justify-between';
</script>

<button {...restProps} class={cn([cBase, restProps.class].join(' '))} {onclick}>
	<div class="flex items-center gap-2">
		<h3 class="text-black-800 text-base">
			{@render children?.()}
		</h3>
	</div>
	<Toggle {checked}></Toggle>
</button>
