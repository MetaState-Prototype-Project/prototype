<script lang="ts">
	import { cn } from '$lib/utils';
	import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface ISettingsNaviationButtonProps extends HTMLButtonAttributes {
		leadingIcon?: Snippet;
		profileSrc?: string;
		children: Snippet;
		onclick?: () => void;
		hasTrailingIcon?: boolean;
	}

	let {
		leadingIcon,
		profileSrc,
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
				class="bg-brand-burnt-orange-100 flex size-8 items-center justify-center rounded-full md:size-10"
			>
				{@render leadingIcon?.()}
			</div>
		{/if}
		{#if profileSrc}
			<img
				width="24px"
				height="24px"
				class="flex aspect-square size-10 items-center justify-center rounded-full md:size-12 object-cover"
				src={profileSrc}
				alt=""
			/>
		{/if}
		<h3 class="text-black-800 text-start text-base">
			{@render children?.()}
		</h3>
	</div>
	{#if hasTrailingIcon}
		<HugeiconsIcon icon={ArrowRight01Icon} color="var(--color-black-400)" />
	{/if}
</button>
