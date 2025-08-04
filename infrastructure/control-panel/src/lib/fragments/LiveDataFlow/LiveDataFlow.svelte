<script lang="ts">
	import { Database01FreeIcons, PauseFreeIcons, PlayFreeIcons } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	interface IEvent {
		id: string;
		from: string;
		to: string;
		imageSrc?: string;
		vaultName?: string;
	}

	interface IDataFlowProps {
		events: IEvent[];
	}

	let { events }: IDataFlowProps = $props();
	let isPaused = $state(false);
</script>

<article class="bg-gray flex h-[80vh] w-full flex-col items-center rounded-md px-16 py-6">
	<div class="mb-20.5 flex w-full items-center justify-between">
		<h4 class="text-xl">Live Monitoring</h4>
		<button
			onclick={() => (isPaused = !isPaused)}
			class="font-geist text-black-700 flex items-center gap-2 rounded-4xl border border-[#e5e5e5] bg-white px-4 py-3 text-base font-medium"
		>
			{#if isPaused}
				<HugeiconsIcon icon={PlayFreeIcons} size="24px" />
			{:else}
				<HugeiconsIcon icon={PauseFreeIcons} size="24px" />
			{/if}
			{isPaused ? 'Resume Live Feed' : 'Pause Live Feed'}
		</button>
	</div>
	<div class="relative z-10 flex w-full items-center justify-between">
		<!-- svelte-ignore element_invalid_self_closing_tag -->
		<div
			class="border-s-green border-b-green border-e-green absolute start-[50%] top-[55%] z-[-1] h-[175px] w-[88%] translate-x-[-50%] rounded-md border border-t-transparent bg-transparent"
		>
			<div
				class="dot bg-green absolute start-[-1px] top-0 h-2.5 w-2.5 rounded-full"
				style="--dot-animation-state: {isPaused ? 'paused' : 'running'}"
			/>
		</div>

		<div
			class="flex flex-col items-center justify-center gap-2 rounded-md border border-black/10 bg-white p-3"
		>
			<HugeiconsIcon icon={Database01FreeIcons} />
			<div class="text-sm font-semibold">{events[0].from}</div>
			<div class="text-xs text-gray-500">{events[0].vaultName}</div>
		</div>

		<div
			class="absolute start-[50%] top-[200px] translate-x-[-50%] rounded-md bg-white p-3 text-center shadow"
		>
			<img src="/" alt="Icon" />
			<div class="text-xs text-gray-700">{events[1].from}</div>
		</div>

		<div
			class="border-green flex flex-col items-center justify-center gap-2 rounded-md border bg-white p-3"
		>
			<HugeiconsIcon icon={Database01FreeIcons} />
			<div class="text-sm font-semibold">{events[2].from}</div>
			<div class="text-xs text-gray-500">{events[2].vaultName}</div>
		</div>
	</div>
</article>

<style>
	.dot {
		offset-path: rect(0px 100% 175px 0px round 0%);
		offset-distance: 0%;
		offset-rotate: auto;
		animation: move 10s linear infinite;
		animation-play-state: var(--dot-animation-state, running);
	}

	@keyframes move {
		0% {
			offset-distance: 100%;
			opacity: 1;
		}
		50% {
			opacity: 1;
		}
		55% {
			opacity: 0.4;
		}
		60% {
			opacity: 0;
		}
		100% {
			offset-distance: 0%;
			opacity: 0;
		}
	}
</style>
