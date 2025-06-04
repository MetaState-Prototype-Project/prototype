<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface ISelectProps extends HTMLAttributes<HTMLElement> {
		options: Array<{
			code: string;
			icon: string;
			name: string;
		}>;
	}

	let {
		options = [
			{ code: '+41', icon: '🇬🇧', name: 'United Kingdom' },
			{ code: '+49', icon: '🇩🇪', name: 'Germany' },
			{ code: '+33', icon: '🇫🇷', name: 'France' }
		],
		...restProps
	}: ISelectProps = $props();

	let selectedCode = $state(options[0].code);

	const cBase = 'bg-grey flex w-[max-content] items-center space-x-2 rounded-full p-1.5';
</script>

<div {...restProps} class={cn([cBase, restProps.class].join(' '))}>
	<div class="rounded-full text-2xl">{options.find((c) => c.code === selectedCode)?.icon}</div>
	<select
		bind:value={selectedCode}
		class="text-base focus:ring-2 focus:ring-transparent focus:outline-none"
	>
		{#each options as country}
			<option value={country.code} class="text-black-600 text-base">
				{country.code}
			</option>
		{/each}
	</select>
</div>
