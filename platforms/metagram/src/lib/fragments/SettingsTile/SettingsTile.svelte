<script lang="ts">
	import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface ISettingsTile extends HTMLButtonAttributes {
		title: string;
		currentStatus: 'string';
		onclick: () => void;
	}

	const { title, currentStatus, onclick, ...restProps }: ISettingsTile = $props();
</script>

<button {...restProps} class="flex w-full cursor-pointer items-center justify-between" {onclick}>
	<div class="flex flex-col items-start gap-1">
		<span class="font-semibold">{title}</span>
		<span class="text-black/60">{currentStatus}</span>
	</div>
	<HugeiconsIcon icon={ArrowRight01Icon} className="text-black/40" />
</button>
