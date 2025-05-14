<script lang="ts">
	import { cn } from '$lib/utils';
	import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface ISettingsNaviationButtonProps extends HTMLButtonAttributes {
		leadingIcon?: Snippet;
		children: Snippet;
		onclick: () => void;
		hasTrailingIcon: boolean;
	}

	let {
		leadingIcon,
		children,
		onclick,
		hasTrailingIcon = true,
		...restProps
	}: ISettingsNaviationButtonProps = $props();

	const cBase = 'flex w-full items-center justify-between';
</script>

<button {...restProps} class={cn([cBase, restProps.class].join(' '))} {onclick}>
	<div class="flex items-center gap-2">
		{#if leadingIcon}
			<div
				class="bg-brand-burnt-orange-100 flex h-10 w-10 items-center justify-center rounded-full"
			>
				{@render leadingIcon?.()}
			</div>
		{/if}
		<h3 class="text-black-800 font-semibold">
			{@render children?.()}
		</h3>
	</div>
	{#if hasTrailingIcon}
		<HugeiconsIcon icon={ArrowRight01Icon} color="var(--color-black-400)" />
	{/if}
</button>
