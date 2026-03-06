<script lang="ts">
	import type { NodeDetail } from './types';

	interface Props {
		selectedNode: NodeDetail | null;
		focusNodeId: string | null;
		focusLabel: string;
	}

	let {
		selectedNode = $bindable(),
		focusNodeId = $bindable(),
		focusLabel = $bindable()
	}: Props = $props();
</script>

<aside
	class="flex w-60 shrink-0 flex-col gap-3 overflow-y-auto rounded-lg border border-gray-200 bg-white p-5"
>
	{#if selectedNode}
		{#key selectedNode.id}
			<!-- Header -->
			<div class="flex items-center justify-between gap-2">
				<h3 class="m-0 text-base font-bold wrap-break-word">{selectedNode.label}</h3>
				<button
					onclick={() => (selectedNode = null)}
					aria-label="Close"
					class="shrink-0 cursor-pointer rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-sm leading-none hover:bg-gray-100"
					>✕</button
				>
			</div>

			<!-- Focus / clear focus -->
			{#if focusNodeId === selectedNode.id}
				<button
					onclick={() => {
						focusNodeId = null;
						focusLabel = '';
					}}
					class="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
				>
					Clear focus
				</button>
			{:else}
				<button
					onclick={() => {
						focusNodeId = selectedNode!.id;
						focusLabel = selectedNode!.label;
					}}
					class="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100"
				>
					Focus this node
				</button>
			{/if}

			<!-- Outgoing -->
			{#if selectedNode.outgoing.length > 0}
				<details open>
					<summary class="accordion-header">
						Outgoing
						<span
							class="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600"
						>
							{selectedNode.outgoing.length}
						</span>
					</summary>
					<div class="flex flex-col gap-1 pt-1 pl-1">
						{#each selectedNode.outgoing as item}
							<details
								name="outgoing-{selectedNode.id}"
								class="overflow-hidden rounded-md border border-gray-100"
							>
								<summary class="ref-summary">
									<span class="shrink-0 font-bold text-violet-600">→</span>
									<span
										class="min-w-0 flex-1 overflow-hidden font-semibold text-ellipsis whitespace-nowrap"
									>
										{item.targetLabel}
									</span>
									<span
										class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500"
									>
										{item.ref.referenceType}
									</span>
								</summary>
								<div class="flex flex-col gap-1.5 bg-white px-3 py-2">
									{#if item.ref.numericScore}
										<div
											class="flex justify-between border-b border-gray-100 pb-1 text-xs"
										>
											<span class="font-semibold text-gray-500">Score</span>
											<span>{item.ref.numericScore} / 5</span>
										</div>
									{/if}
									<div
										class="flex justify-between border-b border-gray-100 pb-1 text-xs"
									>
										<span class="font-semibold text-gray-500">Date</span>
										<span
											>{new Date(
												item.ref.createdAt
											).toLocaleDateString()}</span
										>
									</div>
									<p class="m-0 text-xs leading-snug text-gray-700">
										{item.ref.content}
									</p>
								</div>
							</details>
						{/each}
					</div>
				</details>
			{/if}

			<!-- Incoming -->
			{#if selectedNode.incoming.length > 0}
				<details open>
					<summary class="accordion-header">
						Incoming
						<span
							class="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600"
						>
							{selectedNode.incoming.length}
						</span>
					</summary>
					<div class="flex flex-col gap-1 pt-1 pl-1">
						{#each selectedNode.incoming as item}
							<details
								name="incoming-{selectedNode.id}"
								class="overflow-hidden rounded-md border border-gray-100"
							>
								<summary class="ref-summary">
									<span class="shrink-0 font-bold text-sky-700">←</span>
									<span
										class="min-w-0 flex-1 overflow-hidden font-semibold text-ellipsis whitespace-nowrap"
									>
										{item.authorLabel}
									</span>
									<span
										class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500"
									>
										{item.ref.referenceType}
									</span>
								</summary>
								<div class="flex flex-col gap-1.5 bg-white px-3 py-2">
									{#if item.ref.numericScore}
										<div
											class="flex justify-between border-b border-gray-100 pb-1 text-xs"
										>
											<span class="font-semibold text-gray-500">Score</span>
											<span>{item.ref.numericScore} / 5</span>
										</div>
									{/if}
									<div
										class="flex justify-between border-b border-gray-100 pb-1 text-xs"
									>
										<span class="font-semibold text-gray-500">Date</span>
										<span
											>{new Date(
												item.ref.createdAt
											).toLocaleDateString()}</span
										>
									</div>
									<p class="m-0 text-xs leading-snug text-gray-700">
										{item.ref.content}
									</p>
								</div>
							</details>
						{/each}
					</div>
				</details>
			{/if}

			{#if selectedNode.outgoing.length === 0 && selectedNode.incoming.length === 0}
				<p class="py-4 text-center text-sm text-gray-400">No references for this node.</p>
			{/if}
		{/key}
	{:else}
		<p class="py-4 text-center text-sm text-gray-400">Click a node to see details.</p>
	{/if}
</aside>

<style>
	.accordion-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		padding: 0.5rem 0.25rem;
		list-style: none;
		user-select: none;
	}
	.accordion-header::-webkit-details-marker {
		display: none;
	}
	.accordion-header::before {
		content: '▶';
		font-size: 0.65rem;
		color: #999;
		transition: transform 0.15s;
	}
	details[open] > .accordion-header::before {
		transform: rotate(90deg);
	}
	.ref-summary {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.5rem;
		cursor: pointer;
		font-size: 0.82rem;
		list-style: none;
		background: #fafafa;
	}
	.ref-summary::-webkit-details-marker {
		display: none;
	}
	.ref-summary:hover {
		background: #f3f3f3;
	}
</style>
