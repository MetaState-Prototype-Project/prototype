<script lang="ts">
	import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface ISettingsNaviationButtonProps extends HTMLButtonAttributes {
		leadingIcon?: Snippet;
		children: Snippet;
	}

	let { leadingIcon, children }: ISettingsNaviationButtonProps = $props();
</script>

<button class="flex w-full items-center justify-between">
	<div class="flex items-center gap-2">
		{#if leadingIcon?.()}
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
	<HugeiconsIcon icon={ArrowRight01Icon} />
</button>
