<script lang="ts">
	import { cn } from '$lib/utils';
	import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface ISettingsTile extends HTMLButtonAttributes {
		title: string;
		currentStatus: string;
	}

	const { title, currentStatus, ...restProps }: ISettingsTile = $props();
</script>

<button
	{...restProps}
	class={cn(
		['flex w-full cursor-pointer items-center justify-between', restProps.class].join(' ')
	)}
>
	<div class="flex flex-col items-start gap-1">
		<span class="font-semibold">{title}</span>
		<span class="text-black/60">{currentStatus}</span>
	</div>
	<HugeiconsIcon icon={ArrowRight01Icon} className="text-black/40" />
</button>
