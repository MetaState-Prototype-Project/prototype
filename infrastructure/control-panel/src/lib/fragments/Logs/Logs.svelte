<script lang="ts">
	import type { LogEvent } from '$lib/types';
	import { capitalizeFirstLetter, cn, parseTimestamp } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface ILogsProps extends HTMLAttributes<HTMLElement> {
		events: LogEvent[];
		activeEventIndex: number;
	}

	let { events, activeEventIndex = $bindable(), ...restProps }: ILogsProps = $props();

	const commonClasses = 'w-full h-full rounded-md p-4 bg-white';
	const commonLogClasses =
		'flex cursor-pointer gap-2 rounded-md p-2 transition-colors hover:bg-gray-100';
	const activeLogClass = 'bg-gray-100';
	const actionClasses = {
		upload: 'text-green-600',
		fetch: 'text-blue-800',
		webhook: 'text-red-500'
	};
</script>

<section {...restProps} class={cn(commonClasses, restProps.class)}>
	<h2 class="pb-4 pl-8 text-xl">Logs</h2>
	{#each events as event, i}
		<article
			{...restProps}
			class={cn(commonLogClasses, i === activeEventIndex && activeLogClass)}
			onclick={() => {
				activeEventIndex = i;
			}}
		>
			<p class="font-light text-black/60">[{parseTimestamp(event.timestamp)}]</p>
			<div>
				<span class={actionClasses[event.action]}>
					{capitalizeFirstLetter(event.action)}
					{event.action === 'webhook' ? 'triggered' : ''}
				</span>
				{#if event.action === 'upload'}
					→ {event.to}
				{:else if event.action === 'fetch'}
					← {event.from}
				{:else if event.action === 'webhook'}
					({event.from} → {event.to})
				{/if}
				{#if event.action === 'upload' || event.action === 'fetch'}
					<br />
					({event.message})
				{/if}
			</div>
		</article>
	{/each}
</section>
