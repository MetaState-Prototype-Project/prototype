<script lang="ts">
	import type { PageProps } from './$types';
	import type { ReferenceEdge } from './+page.server';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { Network } from 'vis-network';
	import type { Data, Options } from 'vis-network';

	let { data }: PageProps = $props();

	let container: HTMLDivElement;
	type NodeDetail = {
		id: string;
		label: string;
		outgoing: { ref: ReferenceEdge; targetLabel: string }[];
		incoming: { ref: ReferenceEdge; authorLabel: string }[];
	};

	let selectedNode: NodeDetail | null = $state(null);

	// Color palette per target type
	const TARGET_COLORS: Record<string, { bg: string; border: string }> = {
		user: { bg: '#4A90E2', border: '#2A6FC2' },
		group: { bg: '#50E3C2', border: '#30C3A2' },
		platform: { bg: '#F5A623', border: '#D58603' }
	};

	const AUTHOR_COLOR = { bg: '#9B59B6', border: '#7D3C98' };

	function buildGraph(references: ReferenceEdge[]) {
		const nodeMap = new Map<string, { id: string; label: string; type: string }>();
		const edges: { from: string; to: string; title: string; refData: ReferenceEdge }[] = [];

		// Track degree (number of connections) per node for sizing
		const degree = new Map<string, number>();

		for (const ref of references) {
			// Author node (always a user)
			const authorKey = `user:${ref.author.id}`;
			if (!nodeMap.has(authorKey)) {
				nodeMap.set(authorKey, {
					id: authorKey,
					label: ref.author.name || ref.author.ename || ref.author.id.slice(0, 8),
					type: 'author'
				});
			}

			// Target node
			const targetKey = `${ref.targetType}:${ref.targetId}`;
			if (!nodeMap.has(targetKey)) {
				nodeMap.set(targetKey, {
					id: targetKey,
					label: ref.targetName || ref.targetId.slice(0, 8),
					type: ref.targetType
				});
			}

			// Count connections
			degree.set(authorKey, (degree.get(authorKey) ?? 0) + 1);
			degree.set(targetKey, (degree.get(targetKey) ?? 0) + 1);

			// Edge
			const typeLabel = ref.referenceType || 'general';
			const scoreLabel = ref.numericScore != null ? ` (${ref.numericScore}/5)` : '';
			edges.push({
				from: authorKey,
				to: targetKey,
				title: `${typeLabel}${scoreLabel}`,
				refData: ref
			});
		}

		// Size nodes by degree: more connections = bigger node
		const nodes = Array.from(nodeMap.values()).map((n) => {
			const colors =
				n.type === 'author' ? AUTHOR_COLOR : (TARGET_COLORS[n.type] ?? AUTHOR_COLOR);
			const d = degree.get(n.id) ?? 1;
			const size = 12 + d * 4; // base 12, grows with connections
			return {
				id: n.id,
				label: n.label,
				size,
				color: {
					background: colors.bg,
					border: colors.border,
					highlight: { background: colors.bg, border: '#fff' }
				},
				title: `${n.type}: ${n.label} (${d} connections)`
			};
		});

		return { nodes, edges, nodeMap };
	}

	onMount(() => {
		const references: ReferenceEdge[] = data.references ?? [];
		const graph = buildGraph(references);

		const networkData: Data = {
			nodes: graph.nodes,
			edges: graph.edges.map((e, i) => ({
				id: i,
				from: e.from,
				to: e.to,
				title: e.title,
				arrows: 'to'
			}))
		};

		const options: Options = {
			nodes: {
				shape: 'dot',
				font: { size: 13, color: '#222', strokeWidth: 3, strokeColor: '#fff' },
				borderWidth: 2,
				borderWidthSelected: 4
			},
			edges: {
				width: 1.2,
				color: { color: '#bbb', highlight: '#333', opacity: 0.7 },
				arrows: { to: { enabled: true, scaleFactor: 0.5 } },
				smooth: false // straight lines = much less tangling
			},
			physics: {
				barnesHut: {
					gravitationalConstant: -8000,
					centralGravity: 0.3,
					springLength: 250,
					springConstant: 0.04,
					damping: 0.5, // high damping = stops oscillating quickly
					avoidOverlap: 0.5
				},
				maxVelocity: 50,
				minVelocity: 0.75, // stop physics once nodes are nearly still
				solver: 'barnesHut',
				stabilization: { enabled: true, iterations: 300, fit: true }
			},
			interaction: {
				hover: true,
				tooltipDelay: 150,
				navigationButtons: true,
				keyboard: true
			}
		};

		const network = new Network(container, networkData, options);

		// Disable physics once the initial layout is done — prevents endless spinning
		network.on('stabilizationIterationsDone', () => {
			network.setOptions({ physics: false });
		});

		network.on('click', (params) => {
			if (params.nodes.length > 0) {
				const nodeId = params.nodes[0] as string;
				const nodeInfo = graph.nodeMap.get(nodeId);
				const label = nodeInfo?.label ?? nodeId;

				const outgoing = graph.edges
					.filter((e) => e.from === nodeId)
					.map((e) => ({
						ref: e.refData,
						targetLabel: graph.nodeMap.get(e.to)?.label ?? e.to
					}));

				const incoming = graph.edges
					.filter((e) => e.to === nodeId)
					.map((e) => ({
						ref: e.refData,
						authorLabel: graph.nodeMap.get(e.from)?.label ?? e.from
					}));

				selectedNode = { id: nodeId, label, outgoing, incoming };
			} else {
				selectedNode = null;
			}
		});
		return () => {
			network.destroy();
		};
	});
</script>

<div class="flex h-screen flex-col gap-3 p-6">
	<!-- Header -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="m-0 text-2xl font-extrabold">eReference Network</h1>
			<p class="mt-1 text-sm text-gray-500">
				Showing every signed eReference — who vouches for whom across the ecosystem
			</p>
		</div>
		<div class="flex gap-3">
			<span class="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold">
				{data.references?.length ?? 0} references
			</span>
		</div>
	</div>

	<!-- Legend -->
	<div class="flex flex-wrap gap-5 text-xs text-gray-600">
		<span class="flex items-center gap-1.5">
			<span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#9B59B6"></span>
			Author (user)
		</span>
		<span class="flex items-center gap-1.5">
			<span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#4A90E2"></span>
			Target: user
		</span>
		<span class="flex items-center gap-1.5">
			<span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#50E3C2"></span>
			Target: group
		</span>
		<span class="flex items-center gap-1.5">
			<span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#F5A623"></span>
			Target: platform
		</span>
		<span class="flex items-center gap-1.5 text-gray-400"
			>→ eReference (click node for details)</span
		>
	</div>

	<!-- Main -->
	<div class="flex min-h-0 flex-1 gap-4">
		<div
			bind:this={container}
			class="flex-1 rounded-lg border border-gray-200 bg-gray-50"
		></div>

		<aside
			class="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto rounded-lg border border-gray-200 bg-white p-5"
			in:slide={{ axis: 'x', duration: 150 }}
			out:slide={{ axis: 'x', duration: 150 }}
		>
			{#if selectedNode}
				{#key selectedNode.id}
					<!-- Panel header -->
					<div class="flex items-center justify-between gap-2">
						<h3 class="m-0 text-base font-bold wrap-break-word">
							{selectedNode.label}
						</h3>
						<button
							class="shrink-0 cursor-pointer rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-sm leading-none hover:bg-gray-100"
							onclick={() => (selectedNode = null)}
						>
							✕
						</button>
					</div>

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
											<span class="shrink-0 font-bold text-violet-600">→</span
											>
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
													<span class="font-semibold text-gray-500"
														>Score</span
													>
													<span>{item.ref.numericScore} / 5</span>
												</div>
											{/if}
											<div
												class="flex justify-between border-b border-gray-100 pb-1 text-xs"
											>
												<span class="font-semibold text-gray-500">Date</span
												>
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
													<span class="font-semibold text-gray-500"
														>Score</span
													>
													<span>{item.ref.numericScore} / 5</span>
												</div>
											{/if}
											<div
												class="flex justify-between border-b border-gray-100 pb-1 text-xs"
											>
												<span class="font-semibold text-gray-500">Date</span
												>
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
						<p class="py-4 text-center text-sm text-gray-400">
							No references for this node.
						</p>
					{/if}
				{/key}
			{:else}
				<p class="py-4 text-center text-sm text-gray-400">
					Click a node to see details about its references.
				</p>
			{/if}
		</aside>
	</div>
</div>

<style>
	/*
	 * These two rules use ::before pseudo-elements and the parent details[open] selector,
	 * which cannot be expressed with plain Tailwind utility classes.
	 */
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
