<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface ISelectProps extends HTMLAttributes<HTMLElement> {
		options: Array<{
			code: string;
			flag: string;
			name: string;
		}>;
	}

	let {
		options = [
			{ code: '+41', flag: '🇬🇧', name: 'United Kingdom' },
			{ code: '+49', flag: '🇩🇪', name: 'Germany' },
			{ code: '+33', flag: '🇫🇷', name: 'France' }
		],
		...restProps
	}: ISelectProps = $props();

	let selectedCode = $state(options[0].code);

	const cBase = 'bg-grey flex w-[max-content] items-center space-x-2 rounded-full p-1.5';
</script>

<div {...restProps} class={cn([cBase, restProps.class].join(' '))}>
	<div class="rounded-full text-xl">{options.find((c) => c.code === selectedCode)?.flag}</div>
	<select
		bind:value={selectedCode}
		class="text-md focus:ring-2 focus:ring-transparent focus:outline-none"
	>
		{#each options as country}
			<option value={country.code} class="text-md text-black-600">
				{country.code}
			</option>
		{/each}
	</select>
</div>
