<script lang="ts">
	import type { PageProps } from './$types';
	import type { ReferenceEdge } from './+page.server';
	import { onMount } from 'svelte';
	import { Network } from 'vis-network';
	import type { Data, Options } from 'vis-network';

	let { data }: PageProps = $props();

	let container: HTMLDivElement;
	let selectedRef: ReferenceEdge | null = $state(null);

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
			const scoreLabel = ref.numericScore ? ` (${ref.numericScore}/5)` : '';
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

		return { nodes, edges };
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
					damping: 0.5,      // high damping = stops oscillating quickly
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
			if (params.edges.length > 0) {
				const edgeId = params.edges[0];
				const edge = graph.edges[edgeId];
				if (edge) {
					selectedRef = edge.refData;
				}
			} else {
				selectedRef = null;
			}
		});
	});
</script>

<div class="visualizer-container">
	<div class="header">
		<div>
			<h1>eReference Network</h1>
			<p>Showing every signed eReference — who vouches for whom across the ecosystem</p>
		</div>
		<div class="stats">
			<span class="stat">{data.references?.length ?? 0} references</span>
		</div>
	</div>

	<div class="legend">
		<span class="legend-item"
			><span class="dot" style="background:#9B59B6"></span> Author (user)</span
		>
		<span class="legend-item"
			><span class="dot" style="background:#4A90E2"></span> Target: user</span
		>
		<span class="legend-item"
			><span class="dot" style="background:#50E3C2"></span> Target: group</span
		>
		<span class="legend-item"
			><span class="dot" style="background:#F5A623"></span> Target: platform</span
		>
		<span class="legend-item arrow">→ eReference (click edge for details)</span>
	</div>

	<div class="main">
		<div bind:this={container} class="network-container"></div>

		{#if selectedRef}
			<aside class="detail-panel">
				<h3>eReference Details</h3>
				<div class="detail-row">
					<span class="detail-label">From</span>
					<span>{selectedRef.author.name || selectedRef.author.ename}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">To</span>
					<span>{selectedRef.targetName} <small>({selectedRef.targetType})</small></span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Type</span>
					<span>{selectedRef.referenceType}</span>
				</div>
				{#if selectedRef.numericScore}
					<div class="detail-row">
						<span class="detail-label">Score</span>
						<span>{selectedRef.numericScore} / 5</span>
					</div>
				{/if}
				<div class="detail-row">
					<span class="detail-label">Date</span>
					<span>{new Date(selectedRef.createdAt).toLocaleDateString()}</span>
				</div>
				<div class="detail-content">
					<span class="detail-label">Content</span>
					<p>{selectedRef.content}</p>
				</div>
				<button class="close-btn" onclick={() => (selectedRef = null)}>Close</button>
			</aside>
		{/if}
	</div>
</div>

<style>
	.visualizer-container {
		padding: 1.5rem;
		height: 100vh;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 800;
	}

	p {
		margin: 0.25rem 0 0;
		color: #666;
		font-size: 0.875rem;
	}

	.stats {
		display: flex;
		gap: 0.75rem;
	}

	.stat {
		background: #f0f0f0;
		padding: 0.35rem 0.75rem;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.legend {
		display: flex;
		gap: 1.25rem;
		font-size: 0.8rem;
		color: #555;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		display: inline-block;
	}

	.arrow {
		color: #999;
	}

	.main {
		flex: 1;
		display: flex;
		gap: 1rem;
		min-height: 0;
	}

	.network-container {
		flex: 1;
		border: 1px solid #ddd;
		border-radius: 8px;
		background: #fafafa;
	}

	.detail-panel {
		width: 320px;
		border: 1px solid #ddd;
		border-radius: 8px;
		background: #fff;
		padding: 1.25rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.detail-panel h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.85rem;
		border-bottom: 1px solid #f0f0f0;
		padding-bottom: 0.4rem;
	}

	.detail-label {
		font-weight: 600;
		color: #666;
		font-size: 0.8rem;
	}

	.detail-content {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.detail-content p {
		margin: 0;
		font-size: 0.85rem;
		color: #333;
		line-height: 1.45;
	}

	.close-btn {
		margin-top: auto;
		padding: 0.4rem 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		background: #f8f8f8;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.close-btn:hover {
		background: #eee;
	}
</style>
