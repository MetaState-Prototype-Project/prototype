<script lang="ts">
	import type { PageProps } from './$types';
	import type { ReferenceEdge } from './+page.server';
	import type { NodeDetail } from './types';
	import { onMount, untrack } from 'svelte';
	import { Network } from 'vis-network';
	import type { Options } from 'vis-network';
	import FilterPanel from './FilterPanel.svelte';
	import DetailSidebar from './DetailSidebar.svelte';

	let { data }: PageProps = $props();

	const references: ReferenceEdge[] = $derived(data.references ?? []);

	//  Color palette
	const TARGET_COLORS: Record<string, { bg: string; border: string }> = {
		user: { bg: '#4A90E2', border: '#2A6FC2' },
		group: { bg: '#50E3C2', border: '#30C3A2' },
		platform: { bg: '#F5A623', border: '#D58603' }
	};
	const AUTHOR_COLOR = { bg: '#9B59B6', border: '#7D3C98' };
	const FOCUS_COLOR = { bg: '#EF4444', border: '#B91C1C' };

	//  Filter state
	let focusNodeId = $state<string | null>(null);
	let focusLabel = $state<string>('');
	let depth = $state(3);

	let targetTypeFilters = $state<Record<string, boolean>>({
		user: true,
		group: true,
		platform: true
	});
	let refTypeFilters = $state<Record<string, boolean>>(
		untrack(() =>
			Object.fromEntries(
				[...new Set((data.references ?? []).map((r) => r.referenceType || 'general'))].map(
					(rt) => [rt, true]
				)
			)
		)
	);
	let minScore = $state(0); // 0 = no minimum

	//  Derived: all unique node ids/labels for search
	const allNodes = $derived.by(() => {
		const map = new Map<string, string>();
		for (const ref of references) {
			if (!ref.author) continue;
			const ak = `user:${ref.author.id}`;
			if (!map.has(ak))
				map.set(ak, ref.author.name || ref.author.ename || ref.author.id.slice(0, 8));
			const tk = `${ref.targetType}:${ref.targetId}`;
			if (!map.has(tk)) map.set(tk, ref.targetName || ref.targetId.slice(0, 8));
		}
		return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
	});

	//  Derived: unique ref types for checkboxes
	const allRefTypes = $derived.by(() => {
		const s = new Set<string>();
		for (const ref of references) s.add(ref.referenceType || 'general');
		return Array.from(s).sort();
	});

	// Add any ref types not yet in the map (e.g. if data updates dynamically)
	$effect(() => {
		for (const rt of allRefTypes) {
			if (!(rt in refTypeFilters)) refTypeFilters[rt] = true;
		}
	});

	const hasActiveFilters = $derived(
		focusNodeId !== null ||
			minScore > 0 ||
			Object.values(targetTypeFilters).some((v) => !v) ||
			Object.values(refTypeFilters).some((v) => !v)
	);

	//  Derived: filtered references
	const filteredRefs = $derived.by(() => {
		return references.filter((ref) => {
			if (!ref.author) return false;
			if (!targetTypeFilters[ref.targetType]) return false;
			const rt = ref.referenceType || 'general';
			if (rt in refTypeFilters && !refTypeFilters[rt]) return false;
			if (minScore > 0 && (ref.numericScore == null || ref.numericScore < minScore))
				return false;
			return true;
		});
	});

	//  BFS
	function bfsWithinDepth(
		edges: { from: string; to: string }[],
		startId: string,
		maxDepth: number
	): Set<string> {
		const visited = new Set<string>([startId]);
		const queue: { id: string; d: number }[] = [{ id: startId, d: 0 }];
		while (queue.length) {
			const { id, d } = queue.shift()!;
			if (d >= maxDepth) continue;
			for (const e of edges) {
				let neighbour: string | null = null;
				if (e.from === id) neighbour = e.to;
				else if (e.to === id) neighbour = e.from;
				if (neighbour && !visited.has(neighbour)) {
					visited.add(neighbour);
					queue.push({ id: neighbour, d: d + 1 });
				}
			}
		}
		return visited;
	}

	//  Build vis-network data structures
	function buildGraph(refs: ReferenceEdge[]) {
		const nodeMap = new Map<string, { id: string; label: string; type: string }>();
		const edges: { from: string; to: string; title: string; refData: ReferenceEdge }[] = [];
		const degree = new Map<string, number>();

		for (const ref of refs) {
			if (!ref.author) continue;
			const ak = `user:${ref.author.id}`;
			if (!nodeMap.has(ak))
				nodeMap.set(ak, {
					id: ak,
					label: ref.author.name || ref.author.ename || ref.author.id.slice(0, 8),
					type: 'author'
				});
			const tk = `${ref.targetType}:${ref.targetId}`;
			if (!nodeMap.has(tk))
				nodeMap.set(tk, {
					id: tk,
					label: ref.targetName || ref.targetId.slice(0, 8),
					type: ref.targetType
				});
			degree.set(ak, (degree.get(ak) ?? 0) + 1);
			degree.set(tk, (degree.get(tk) ?? 0) + 1);
			edges.push({
				from: ak,
				to: tk,
				title: `${ref.referenceType || 'general'}${ref.numericScore != null ? ` (${ref.numericScore}/5)` : ''}`,
				refData: ref
			});
		}

		return { nodeMap, edges, degree };
	}

	//  Derived: graphData (nodes + edges arrays ready for vis-network)
	const graphData = $derived.by(() => {
		const { nodeMap, edges, degree } = buildGraph(filteredRefs);

		let visibleIds: Set<string> | null = null;
		if (focusNodeId) {
			visibleIds = bfsWithinDepth(edges, focusNodeId, depth);
		}

		const nodes = Array.from(nodeMap.values())
			.filter((n) => !visibleIds || visibleIds.has(n.id))
			.map((n) => {
				const isFocus = n.id === focusNodeId;
				const colors = isFocus
					? FOCUS_COLOR
					: n.type === 'author'
						? AUTHOR_COLOR
						: (TARGET_COLORS[n.type] ?? AUTHOR_COLOR);
				const d = degree.get(n.id) ?? 1;
				const size = isFocus ? 22 : 12 + d * 4;
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

		const visEdges = edges
			.filter((e) => !visibleIds || (visibleIds.has(e.from) && visibleIds.has(e.to)))
			.map((e, i) => ({ id: i, from: e.from, to: e.to, title: e.title, arrows: 'to' }));

		return { nodes, edges: visEdges, nodeMap, rawEdges: edges };
	});

	//  vis-network instance
	let container: HTMLDivElement;
	let network: Network | null = null;
	let networkReady = $state(false);

	const physicsOptions: Options = {
		physics: {
			barnesHut: {
				gravitationalConstant: -8000,
				centralGravity: 0.3,
				springLength: 250,
				springConstant: 0.04,
				damping: 0.5,
				avoidOverlap: 0.5
			},
			maxVelocity: 50,
			minVelocity: 0.75,
			solver: 'barnesHut',
			stabilization: { enabled: true, iterations: 300, fit: true }
		}
	};

	let selectedNode = $state<NodeDetail | null>(null);

	onMount(() => {
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
				smooth: false
			},
			...physicsOptions,
			interaction: { hover: true, tooltipDelay: 150, navigationButtons: true, keyboard: true }
		};

		network = new Network(
			container,
			{ nodes: graphData.nodes, edges: graphData.edges },
			options
		);

		network.on('stabilizationIterationsDone', () => {
			network!.setOptions({ physics: false });
		});

		network.on('click', (params) => {
			if (params.nodes.length > 0) {
				const nodeId = params.nodes[0] as string;
				const nodeInfo = graphData.nodeMap.get(nodeId);
				const label = nodeInfo?.label ?? nodeId;
				const outgoing = graphData.rawEdges
					.filter((e) => e.from === nodeId)
					.map((e) => ({
						ref: e.refData,
						targetLabel: graphData.nodeMap.get(e.to)?.label ?? e.to
					}));
				const incoming = graphData.rawEdges
					.filter((e) => e.to === nodeId)
					.map((e) => ({
						ref: e.refData,
						authorLabel: graphData.nodeMap.get(e.from)?.label ?? e.from
					}));
				selectedNode = { id: nodeId, label, outgoing, incoming };
			} else {
				selectedNode = null;
			}
		});

		networkReady = true;

		return () => {
			network?.destroy();
			network = null;
		};
	});

	//  Reactively update vis-network when graphData changes
	$effect(() => {
		if (!networkReady || !network) return;
		const { nodes, edges } = graphData; // subscribe
		network.setData({ nodes, edges });
		network.setOptions(physicsOptions);
	});
</script>

<div class="flex h-screen flex-col gap-3">
	<!-- Header -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="m-0 text-2xl font-extrabold">eReference Network</h1>
			<p class="mt-1 text-sm text-gray-500">
				Force-directed graph of signed eReferences across the ecosystem
			</p>
		</div>
		<div class="flex gap-2 text-xs">
			<span class="rounded-md bg-gray-100 px-3 py-1.5 font-semibold">
				{data.references?.length ?? 0} total
			</span>
			{#if hasActiveFilters}
				<span class="rounded-md bg-blue-100 px-3 py-1.5 font-semibold text-blue-700">
					{graphData.nodes.length} shown
				</span>
			{/if}
		</div>
	</div>

	<!-- Legend -->
	<div class="flex flex-wrap gap-5 text-xs text-gray-600">
		<span class="flex items-center gap-1.5"
			><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#9B59B6"
			></span>Author (user)</span
		>
		<span class="flex items-center gap-1.5"
			><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#4A90E2"
			></span>Target: user</span
		>
		<span class="flex items-center gap-1.5"
			><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#50E3C2"
			></span>Target: group</span
		>
		<span class="flex items-center gap-1.5"
			><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#F5A623"
			></span>Target: platform</span
		>
		{#if focusNodeId}
			<span class="flex items-center gap-1.5"
				><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#EF4444"
				></span>Focus node</span
			>
		{/if}
	</div>

	<!-- Main row: filter | graph | sidebar -->
	<div class="flex min-h-0 flex-1 gap-4">
		<FilterPanel
			{allNodes}
			{allRefTypes}
			{hasActiveFilters}
			bind:focusNodeId
			bind:focusLabel
			bind:depth
			bind:targetTypeFilters
			bind:refTypeFilters
			bind:minScore
		/>
		<!--  Graph canvas  -->
		<div
			bind:this={container}
			class="flex-1 rounded-lg border border-gray-200 bg-gray-50"
		></div>

		<DetailSidebar bind:selectedNode bind:focusNodeId bind:focusLabel />
	</div>
</div>
