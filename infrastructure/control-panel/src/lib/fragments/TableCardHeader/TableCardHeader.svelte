<script lang="ts">
	import { Search01FreeIcons } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	let {
		title,
		searchValue = $bindable(''),
		rightTitle,
		placeholder,
		showClearSelection = false,
		onClearSelection = () => {}
	}: {
		title: string;
		searchValue: string;
		rightTitle: string;
		placeholder: string;
		showClearSelection?: boolean;
		onClearSelection?: () => void;
	} = $props();
</script>

<header class="mb-4 flex w-full items-center justify-between px-4">
	<div class="flex items-center gap-4">
		<p class="text-black-700 whitespace-nowrap font-semibold">{title}</p>
		<div class="relative w-full">
			<input
				type="text"
				{placeholder}
				bind:value={searchValue}
				class="bg-black-100 text-black-700 placeholder:text-black-700 w-full rounded-[8px] border border-gray-300 px-4 py-1.5 pr-10 text-xs outline-0"
			/>
			<span class="text-black-700 absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2">
				<HugeiconsIcon
					icon={Search01FreeIcons}
					size="16px"
					color="var(--color-black-500)"
				/>
			</span>
		</div>
	</div>

	<div class="flex items-center gap-2">
		{#if showClearSelection}
			<button
				onclick={onClearSelection}
				class="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200"
			>
				Clear Selection
			</button>
		{/if}
		<span class="bg-secondary inline-block h-2 w-2 rounded-full"></span>
		<p class="text-black-700 text-sm">{rightTitle}</p>
	</div>
</header>
