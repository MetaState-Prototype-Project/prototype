<script lang="ts">
	import { SvelteFlow, Background, Controls } from '@xyflow/svelte';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import '@xyflow/svelte/dist/style.css';
	import type { Node, Edge, NodeTypes } from '@xyflow/svelte';
	import { Logs, VaultNode } from '$lib/fragments';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Database01FreeIcons, PauseFreeIcons, PlayFreeIcons } from '@hugeicons/core-free-icons';
	import type { LogEvent } from '$lib/types';

	let SvelteFlowComponent: typeof import('@xyflow/svelte').SvelteFlow | null = $state(null);

	const customNodeTypes = {
		vault: VaultNode
	};

	let isPaused = $state(false);

	// Read selected items from sessionStorage
	let selectedEVaults = $state<any[]>([]);
	let selectedPlatforms = $state<any[]>([]);
	let nodes: Node[] = $state([]);
	let edges: Edge[] = $state([]);

	// Data flow state
	let currentFlowStep = $state(0);
	let flowMessages = $state<string[]>([]);
	let eventSource: EventSource | null = null;
	let highlightedNodeId = $state<string | null>(null);
	let sequenceStarted = $state(false);

	onMount(() => {
		// Load selected items from sessionStorage
		const evaultsData = sessionStorage.getItem('selectedEVaults');
		const platformsData = sessionStorage.getItem('selectedPlatforms');

		if (evaultsData) {
			selectedEVaults = JSON.parse(evaultsData);
			console.log('Loaded selectedEVaults from sessionStorage:', selectedEVaults);
		}
		if (platformsData) {
			selectedPlatforms = JSON.parse(platformsData);
			console.log('Loaded selectedPlatforms from sessionStorage:', selectedPlatforms);
		}

		// Check if any items are selected, if not show selection interface
		if (
			(!selectedEVaults || selectedEVaults.length === 0) &&
			(!selectedPlatforms || selectedPlatforms.length === 0)
		) {
			// Don't redirect, just show empty state
			return;
		}

		// Check if any items are selected, if not show selection interface
		if (
			(!selectedEVaults || selectedEVaults.length === 0) &&
			(!selectedPlatforms || selectedPlatforms.length === 0)
		) {
			return;
		}

		// Create nodes from selected items
		const newNodes: Node[] = [];
		let nodeId = 1;

		// Add service nodes at the top (x: 400, 600, 800, y: 50)
		newNodes.push({
			id: 'registry',
			position: { x: 400, y: 50 },
			data: {
				label: 'Registry',
				subLabel: 'Service',
				type: 'service',
				selected: false
			},
			type: 'vault'
		});

		newNodes.push({
			id: 'ontology',
			position: { x: 600, y: 50 },
			data: {
				label: 'Ontology Service',
				subLabel: 'Service',
				type: 'service',
				selected: false
			},
			type: 'vault'
		});

		newNodes.push({
			id: 'provisioner',
			position: { x: 800, y: 50 },
			data: {
				label: 'eVault Provisioner',
				subLabel: 'Service',
				type: 'service',
				selected: false
			},
			type: 'vault'
		});

		// Add eVaults in a column on the left (x: 200, y: starting from 500)
		selectedEVaults.forEach((evault, index) => {
			newNodes.push({
				id: `evault-${index + 1}`,
				position: { x: 200, y: 500 + index * 180 },
				data: {
					label: evault.evaultId || evault.name || 'eVault',
					subLabel: evault.serviceUrl || evault.ip || 'Unknown',
					type: 'evault',
					selected: false
				},
				type: 'vault'
			});
		});

		// Add platforms in a column on the right (x: 800, y: starting from 500)
		selectedPlatforms.forEach((platform, index) => {
			newNodes.push({
				id: `platform-${index + 1}`,
				position: { x: 800, y: 500 + index * 180 },
				data: {
					label: platform.name,
					subLabel: platform.url,
					type: 'platform',
					selected: false
				},
				type: 'vault'
			});
		});

		nodes = newNodes;
		// Start with no edges (connections)
		edges = [];

		// Load SvelteFlow component
		loadSvelteFlow();

		// Start subscription immediately on mount
		subscribeToEvents();

		// Initialize sequence state to show we're ready
		sequenceStarted = true;
		currentFlowStep = 0;
	});

	async function loadSvelteFlow() {
		const mod = await import('@xyflow/svelte');
		SvelteFlowComponent = mod.SvelteFlow;
	}

	onDestroy(() => {
		if (eventSource) {
			eventSource.close();
		}
	});

	function subscribeToEvents() {
		eventSource = new EventSource('/api/events');

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				handleFlowEvent(data);
			} catch (error) {
				console.error('Error parsing SSE data:', error);
			}
		};

		eventSource.onerror = (error) => {
			console.error('SSE connection error:', error);
			// Try to reconnect after a delay
			setTimeout(() => {
				if (eventSource) {
					eventSource.close();
					subscribeToEvents();
				}
			}, 2000);
		};

		eventSource.onopen = () => {
			console.log('SSE connection established');
		};
	}

	function handleFlowEvent(data: any) {
		console.log('handleFlowEvent received:', data);

		switch (data.type) {
			case 'evault_sync_event':
				handleEvaultSyncEvent(data);
				break;
			case 'platform_message_created':
				handlePlatformMessageCreated(data);
				break;
			case 'request_sent_to_evault':
				handleRequestSentToEvault(data);
				break;
			case 'evault_metaenvelope_created':
				handleEvaultMetaenvelopeCreated(data);
				break;
			case 'notify_platforms_awareness':
				handleNotifyPlatformsAwareness(data);
				break;
		}
	}

	function handleEvaultSyncEvent(data: any) {
		console.log('handleEvaultSyncEvent received data:', data);
		console.log('selectedEVaults:', selectedEVaults);
		console.log('selectedPlatforms:', selectedPlatforms);

		// Map the real data to visualization indices
		const platformIndex = getPlatformIndex(data.platform);
		const evaultIndex = getEvaultIndex(data.w3id);

		console.log('Mapped indices:', {
			platformIndex,
			evaultIndex,
			platform: data.platform,
			w3id: data.w3id
		});

		// Step 1: Platform creates entry locally
		currentFlowStep = 1;
		flowMessages = [
			...flowMessages,
			`[${new Date(data.timestamp).toLocaleTimeString()}] ${data.platform}: Created ${data.tableName} entry locally`
		];

		// Highlight the platform
		highlightNode(`platform-${platformIndex + 1}`);

		// Step 2: After 1 second, show syncing to eVault
		setTimeout(() => {
			currentFlowStep = 2;
			flowMessages = [
				...flowMessages,
				`[${new Date().toLocaleTimeString()}] ${data.message}`
			];

			// Clear old edges first
			edges = [];

			// Create arrow from platform to eVault
			const platformId = `platform-${platformIndex + 1}`;
			const evaultId = `evault-${evaultIndex + 1}`;

			console.log('Creating edge from:', platformId, 'to:', evaultId);

			const newEdge: Edge = {
				id: `flow-${Date.now()}`,
				source: platformId,
				target: evaultId,
				type: 'bezier',
				animated: true,
				style: 'stroke: #007BFF; stroke-width: 3; marker-end: url(#arrowhead-blue);',
				label: `Syncing ${data.tableName}`
			};

			edges = [newEdge];

			// Highlight the platform and eVault
			highlightNode(platformId);
			setTimeout(() => highlightNode(evaultId), 1000);

			// Remove this edge after 3 seconds and then show awareness protocol
			setTimeout(() => {
				edges = edges.filter((edge) => edge.id !== newEdge.id);

				// After sync completes, show the awareness protocol
				setTimeout(() => {
					handleAwarenessProtocol(evaultIndex, data);
				}, 500);
			}, 3000);
		}, 1000);
	}

	function handleAwarenessProtocol(evaultIndex: number, data: any) {
		currentFlowStep = 4;
		flowMessages = [
			...flowMessages,
			`[${new Date().toLocaleTimeString()}] eVault ${evaultIndex + 1}: Notifying platforms through awareness protocol`
		];

		// Clear old edges first
		edges = [];

		// Create edges from eVault to all platforms
		const evaultId = `evault-${evaultIndex + 1}`;
		const newEdges: Edge[] = selectedPlatforms.map((platform, index) => ({
			id: `awareness-${Date.now()}-${index}`,
			source: evaultId,
			target: `platform-${index + 1}`,
			type: 'bezier',
			animated: true,
			style: 'stroke: #28a745; stroke-width: 3; marker-end: url(#arrowhead-green);',
			label: 'Awareness Protocol'
		}));

		edges = newEdges;

		// Remove all awareness edges after 5 seconds and show completion
		setTimeout(() => {
			edges = edges.filter((edge) => !edge.id.startsWith('awareness-'));

			// Step 5: Show completion message
			setTimeout(() => {
				currentFlowStep = 5;
				flowMessages = [
					...flowMessages,
					`[${new Date().toLocaleTimeString()}] All platforms notified successfully`
				];
			}, 500);
		}, 5000);
	}

	function handlePlatformMessageCreated(data: any) {
		currentFlowStep = 1;
		flowMessages = [
			...flowMessages,
			`[${new Date().toLocaleTimeString()}] ${data.platformName}: ${data.message}`
		];

		// Highlight the platform
		highlightNode(`platform-${data.platformIndex + 1}`);
	}

	function handleRequestSentToEvault(data: any) {
		currentFlowStep = 2;
		flowMessages = [
			...flowMessages,
			`[${new Date().toLocaleTimeString()}] Request sent from ${data.platformName} to eVault ${data.evaultIndex + 1}`
		];

		// Clear old edges first
		edges = [];

		// Create arrow from platform to eVault
		const platformId = `platform-${data.platformIndex + 1}`;
		const evaultId = `evault-${data.evaultIndex + 1}`;

		console.log('Creating edge from:', platformId, 'to:', evaultId);

		const newEdge: Edge = {
			id: `flow-${Date.now()}`,
			source: platformId,
			target: evaultId,
			type: 'bezier',
			animated: true,
			style: 'stroke: #007BFF; stroke-width: 3; marker-end: url(#arrowhead-blue);',
			label: 'Syncing to eVault'
		};

		edges = [newEdge];

		// Remove this edge after 5 seconds
		setTimeout(() => {
			edges = edges.filter((edge) => edge.id !== newEdge.id);
		}, 5000);
	}

	function handleEvaultMetaenvelopeCreated(data: any) {
		currentFlowStep = 3;
		flowMessages = [
			...flowMessages,
			`[${new Date().toLocaleTimeString()}] eVault ${data.evaultIndex + 1}: ${data.message}`
		];

		// Highlight the eVault
		highlightNode(`evault-${data.evaultIndex + 1}`);
	}

	function handleNotifyPlatformsAwareness(data: any) {
		currentFlowStep = 4;
		flowMessages = [
			...flowMessages,
			`[${new Date().toLocaleTimeString()}] eVault ${data.evaultIndex + 1}: ${data.message}`
		];

		// Clear old edges first
		edges = [];

		// Create edges from eVault to all platforms
		const evaultId = `evault-${data.evaultIndex + 1}`;
		const newEdges: Edge[] = selectedPlatforms.map((platform, index) => ({
			id: `awareness-${Date.now()}-${index}`,
			source: evaultId,
			target: `platform-${index + 1}`,
			type: 'bezier',
			animated: true,
			style: 'stroke: #28a745; stroke-width: 3; marker-end: url(#arrowhead-green);',
			label: 'Awareness Protocol'
		}));

		edges = newEdges;

		// Remove all awareness edges after 5 seconds
		setTimeout(() => {
			edges = edges.filter((edge) => !edge.id.startsWith('awareness-'));
		}, 5000);
	}

	function highlightNode(nodeId: string) {
		// Set the highlighted node
		highlightedNodeId = nodeId;

		// Update the node data to show it's selected
		nodes = nodes.map((node) => {
			if (node.id === nodeId) {
				return {
					...node,
					data: {
						...node.data,
						selected: true
					}
				};
			} else {
				return {
					...node,
					data: {
						...node.data,
						selected: false
					}
				};
			}
		});

		// Remove highlight after 2 seconds
		setTimeout(() => {
			highlightedNodeId = null;
			nodes = nodes.map((node) => ({
				...node,
				data: {
					...node.data,
					selected: false
				}
			}));
		}, 2000);
	}

	let currentSelectedEventIndex = $state(-1);

	// Function to start the sequence
	function startSequence() {
		// If already running, don't restart
		if (sequenceStarted && currentFlowStep < 4) return;

		sequenceStarted = true;
		currentFlowStep = 0;
		// Don't clear flowMessages - keep old logs
		edges = [];

		// Only start new SSE connection if one doesn't exist
		if (!eventSource) {
			subscribeToEvents();
		}
	}

	// Function to reset the sequence
	function resetSequence() {
		sequenceStarted = false;
		currentFlowStep = 0;
		// Don't clear flowMessages - keep old logs
		edges = [];

		// Close existing connection
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
	}

	// Helper functions to map real data to visualization indices
	function getPlatformIndex(platformName: string): number {
		// Try exact match first
		let index = selectedPlatforms.findIndex((p) => p.name === platformName);

		// If no exact match, try partial matching
		if (index === -1) {
			index = selectedPlatforms.findIndex(
				(p) =>
					p.name.toLowerCase().includes(platformName.toLowerCase()) ||
					platformName.toLowerCase().includes(p.name.toLowerCase())
			);
		}

		// If still no match, try matching by URL
		if (index === -1) {
			index = selectedPlatforms.findIndex(
				(p) =>
					p.url.toLowerCase().includes(platformName.toLowerCase()) ||
					platformName.toLowerCase().includes(p.url.toLowerCase())
			);
		}

		return index >= 0 ? index : 0;
	}

	function getEvaultIndex(w3id: string): number {
		console.log('getEvaultIndex called with w3id:', w3id);
		console.log('selectedEVaults:', selectedEVaults);

		// Since evaultId is the same as w3id, prioritize that match
		const index = selectedEVaults.findIndex((e) => {
			const matches = e.evaultId === w3id;

			if (matches) {
				console.log('Found matching eVault by evaultId:', e);
			}

			return matches;
		});

		console.log('getEvaultIndex result:', {
			w3id,
			foundIndex: index,
			selectedEVaultsLength: selectedEVaults.length
		});

		// If no match found, log all available evaultIds for debugging
		if (index === -1) {
			console.log('No match found for w3id:', w3id);
			console.log('Available evaultIds:');
			selectedEVaults.forEach((evault, i) => {
				console.log(`eVault ${i}: evaultId = "${evault.evaultId}"`);
			});

			// Fall back to index 0 if no match found
			console.log('Falling back to index 0');
			return 0;
		}

		return index;
	}
</script>

{#if (!selectedEVaults || selectedEVaults.length === 0) && (!selectedPlatforms || selectedPlatforms.length === 0)}
	<!-- No items selected - show selection interface -->
	<div class="flex h-full w-full items-center justify-center">
		<div class="text-center">
			<h2 class="mb-4 text-2xl font-bold text-gray-900">No Items Selected</h2>
			<p class="mb-6 text-gray-600">
				Please select eVaults and/or platforms from the home page to start monitoring.
			</p>
			<button
				onclick={() => goto('/')}
				class="bg-primary hover:bg-primary-600 rounded-full px-8 py-3 text-lg font-semibold text-white transition-colors"
			>
				Back to Selection
			</button>
		</div>
	</div>
{:else}
	<section class="flex h-full w-full">
		<div class="bg-gray flex h-screen w-screen flex-col">
			<div class="z-10 flex w-full items-center justify-between bg-white p-4">
				<div>
					<h4 class="text-xl font-semibold text-gray-800">Live Monitoring</h4>
					<p class="mt-1 text-sm text-gray-600">
						Monitoring {selectedEVaults.length} eVault{selectedEVaults.length !== 1
							? 's'
							: ''} and {selectedPlatforms.length} platform{selectedPlatforms.length !==
						1
							? 's'
							: ''}
					</p>
					{#if currentFlowStep > 0}
						<div class="mt-2 flex items-center gap-2">
							<div class="h-3 w-3 animate-pulse rounded-full bg-green-500"></div>
							<span class="text-xs font-medium text-green-600">
								{currentFlowStep === 1
									? 'Platform creating entry locally'
									: currentFlowStep === 2
										? 'Syncing to eVault'
										: currentFlowStep === 3
											? 'eVault created metaenvelope'
											: currentFlowStep === 4
												? 'Awareness Protocol'
												: currentFlowStep === 5
													? 'All platforms notified'
													: 'Complete'}
							</span>
						</div>
					{/if}
				</div>
				<div class="flex gap-2">
					<button
						onclick={() => goto('/')}
						class="font-geist flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-md transition-colors hover:bg-gray-50"
					>
						← Back to Control Panel
					</button>
					<button
						onclick={() => (isPaused = !isPaused)}
						class="font-geist flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-md transition-colors hover:bg-gray-50"
					>
						{#if isPaused}
							<HugeiconsIcon icon={PlayFreeIcons} size="20px" />
						{:else}
							<HugeiconsIcon icon={PauseFreeIcons} size="20px" />
						{/if}
						{isPaused ? 'Resume Live Feed' : 'Pause Live Feed'}
					</button>
				</div>
			</div>

			{#if SvelteFlowComponent}
				<div class="flex-grow">
					<SvelteFlow
						bind:nodes
						bind:edges
						nodeTypes={customNodeTypes}
						style="width: 100%; height: 100%; background: transparent;"
					>
						<Background />
						<Controls />

						<!-- SVG Definitions for Arrow Markers -->
						<svg style="position: absolute; width: 0; height: 0;">
							<defs>
								<marker
									id="arrowhead-blue"
									markerWidth="3"
									markerHeight="7"
									refX="3"
									refY="3.5"
									orient="auto"
								>
									<polygon points="0 0, 3 3.5, 0 7" fill="#007BFF" />
								</marker>
								<marker
									id="arrowhead-green"
									markerWidth="3"
									markerHeight="7"
									refX="3"
									refY="3.5"
									orient="auto"
								>
									<polygon points="0 0, 3 3.5, 0 7" fill="#28a745" />
								</marker>
							</defs>
						</svg>
					</SvelteFlow>
				</div>
			{:else}
				<div class="flex flex-grow items-center justify-center text-gray-700">
					Loading flow chart...
				</div>
			{/if}
		</div>

		<!-- Flow Messages Panel -->
		<div
			class="flex h-full w-[40%] cursor-default flex-col bg-white p-4 transition-colors hover:bg-gray-50"
		>
			<div class="mb-4">
				<h3 class="text-lg font-semibold text-gray-800">Data Flow</h3>
				<div class="mt-2 text-sm text-gray-600">
					Current Step: {currentFlowStep === 0
						? 'Waiting for events...'
						: currentFlowStep === 1
							? 'Platform creating entry locally'
							: currentFlowStep === 2
								? 'Syncing to eVault'
								: currentFlowStep === 3
									? 'eVault created metaenvelope'
									: currentFlowStep === 4
										? 'Awareness Protocol'
										: currentFlowStep === 5
											? 'All platforms notified'
											: 'Complete'}
				</div>
			</div>

			<div class="flex-1 space-y-2 overflow-y-auto">
				{#each flowMessages as message, i}
					<div class="rounded bg-gray-50 p-2 font-mono text-sm">
						{message}
					</div>
				{/each}
			</div>
		</div>
	</section>
{/if}

<style>
	/*
  :global(.svelte-flow__edge-path) {
      stroke: #4CAF50 !important;
      stroke-width: 2 !important;
  }
  */

	:global(.svelte-flow__edge.animated .svelte-flow__edge-path) {
		stroke-dasharray: 5 5;
	}

	:global(.svelte-flow) {
		background-color: transparent !important;
		--xy-edge-label-color-default: black;
	}

	/* Make edge labels bigger and more readable */
	:global(.svelte-flow__edge-label) {
		font-size: 14px !important;
		font-weight: 600 !important;
		background-color: rgba(255, 255, 255, 0.9) !important;
		padding: 4px 8px !important;
		border-radius: 4px !important;
		border: 1px solid rgba(0, 0, 0, 0.1) !important;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
	}

	/* Make default edges more curved and squiggly */
	:global(.svelte-flow__edge-path) {
		stroke-linecap: round !important;
		stroke-linejoin: round !important;
	}

	/* Override the default edge path to be more curved */
	:global(.svelte-flow__edge.default .svelte-flow__edge-path) {
		stroke-dasharray: none !important;
	}

	/* Hide handles on service nodes */
	:global(.svelte-flow__node[data-id='registry'] .svelte-flow__handle),
	:global(.svelte-flow__node[data-id='ontology'] .svelte-flow__handle),
	:global(.svelte-flow__node[data-id='provisioner'] .svelte-flow__handle) {
		visibility: hidden !important;
	}
</style>
