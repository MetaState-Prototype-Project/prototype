<script lang="ts">
	import { onMount } from 'svelte';
	import '@xyflow/svelte/dist/style.css';
	import type { Node, Edge, NodeTypes } from '@xyflow/svelte';
	import { Logs, VaultNode } from '$lib/fragments';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PauseFreeIcons, PlayFreeIcons } from '@hugeicons/core-free-icons';
	import { ButtonAction } from '$lib/ui';
	import { Modal } from 'flowbite-svelte';
	import type { LogEvent } from '$lib/types';

	let SvelteFlowComponent: typeof import('@xyflow/svelte').SvelteFlow | null = $state(null);

	const customNodeTypes: NodeTypes = {
		vault: VaultNode
	};

	let isPaused = $state(false);
	let isModalOpen = $state(false);
	let selectedVaults: string[] = $state([]);

	let nodes: Node[] = $state([
		{
			id: '1',
			position: { x: 50, y: 50 },
			data: { label: 'Alice', subLabel: 'alice.vault.dev' },
			type: 'vault'
		},
		{
			id: '2',
			position: { x: 300, y: 150 },
			data: { label: 'Pictique', subLabel: 'pictique.com' },
			type: 'vault'
		},
		{
			id: '3',
			position: { x: 550, y: 50 },
			data: { label: 'Bob', subLabel: 'bob.vault.dev' },
			type: 'vault'
		},
		{
			id: '4',
			position: { x: 750, y: 250 },
			data: { label: 'xyz', subLabel: 'xyz.vault.dev' },
			type: 'vault'
		}
	]);

	let edges: Edge[] = $derived(
		(() => {
			const generatedEdges: Edge[] = [];

			nodes.forEach((node, index, arr) => {
				if (index < arr.length - 1) {
					// Skip default connection if it's part of the explicit two-way connection
					// This ensures we don't have duplicate edges
					if (
						(node.id === '1' && arr[index + 1].id === '2') ||
						(node.id === '2' && arr[index + 1].id === '1')
					) {
						return;
					}
					generatedEdges.push({
						id: `e${node.id}-${arr[index + 1].id}`,
						source: node.id,
						target: arr[index + 1].id,
						animated: !isPaused,
						type: 'smoothstep',
						label: `from ${node.data.label}`,
						style: 'stroke: #4CAF50; stroke-width: 2;'
					});
				}
			});

			generatedEdges.push(
				{
					id: 'e-alice-to-pictique',
					source: '1',
					target: '2',
					animated: !isPaused,
					type: 'smoothstep',
					label: 'from Alice',
					labelStyle: 'fill: #fff; fontWeight: 700',
					style: 'stroke: #007BFF; stroke-width: 2;'
				},
				{
					id: 'e-pictique-from-alice',
					source: '2',
					target: '1',
					animated: !isPaused,
					type: 'smoothstep',
					label: 'from Pictique',
					labelStyle: 'fill: #fff; fontWeight: 700',
					style: 'stroke: #FFA500; stroke-width: 2;'
				}
			);

			return generatedEdges;
		})()
	);

	let currentSelectedEventIndex = $state(-1);

	const events: LogEvent[] = [
		{
			timestamp: new Date(),
			action: 'upload',
			message: 'msg_123',
			to: 'alice.vault.dev'
		},
		{
			timestamp: new Date(),
			action: 'fetch',
			message: 'msg_124',
			from: 'bob.vault.dev'
		},
		{
			timestamp: new Date(),
			action: 'webhook',
			to: 'Alice',
			from: 'Pic'
		}
	];

	let availableVaults = $state([
		// Renamed to clarify its purpose
		{
			id: '5',
			position: { x: 950, y: 350 },
			data: { label: 'personal', subLabel: 'Personal.vault.dev' },
			type: 'vault'
		},
		{
			id: '6',
			position: { x: 1150, y: 550 },
			data: { label: 'Another', subLabel: 'Another.vault.dev' },
			type: 'vault'
		}
	]);

	function addVaultsToFlow() {
		const vaultsToAdd = availableVaults.filter((vault) => selectedVaults.includes(vault.id));
		nodes = [...nodes, ...vaultsToAdd];

		availableVaults = availableVaults.filter((vault) => !selectedVaults.includes(vault.id));
		selectedVaults = [];
		isModalOpen = false;
	}

	onMount(async () => {
		const mod = await import('@xyflow/svelte');
		SvelteFlowComponent = mod.SvelteFlow;
	});
</script>

<section class="flex h-full w-full">
	<div class="bg-gray flex h-screen w-screen flex-col">
		<div class="z-10 flex w-full items-center justify-between bg-white p-4 shadow-sm">
			<h4 class="text-xl font-semibold text-gray-800">Live Monitoring</h4>
			<div class="flex gap-2">
				<ButtonAction
					class="w-[max-content] shadow-md"
					variant="soft"
					size="sm"
					callback={() => {
						isModalOpen = !isModalOpen;
					}}>+ Add Vault</ButtonAction
				>
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
				<SvelteFlowComponent
					bind:nodes
					bind:edges
					nodeTypes={customNodeTypes}
					style="width: 100%; height: 100%; background: transparent;"
				/>
			</div>
		{:else}
			<div class="flex flex-grow items-center justify-center text-gray-700">
				Loading flow chart...
			</div>
		{/if}
	</div>
	<Logs class="w-[40%]" {events} bind:activeEventIndex={currentSelectedEventIndex} />
</section>

<Modal
	bind:open={isModalOpen}
	class="absolute start-[50%] top-[50%] w-full max-w-[30vw] translate-x-[-50%] translate-y-[-50%] p-4"
	closeBtnClass="fixed end-4 top-4"
>
	<h4 class="text-primary mb-2">Search vaults</h4>
	<input
		type="search"
		value=""
		placeholder="Please search vaults to add"
		class="bg-gray font-geist placeholder:font-geist w-full rounded-4xl border-transparent px-4 py-3 text-base text-black outline-transparent placeholder:text-gray-600"
	/>

	<ul class="mt-4">
		{#each availableVaults as vault (vault.id)}
			<li
				class="bg-gray mb-2 flex items-center gap-4 rounded-2xl px-4 py-1 hover:bg-gray-200"
			>
				<input id={vault.id} type="checkbox" value={vault.id} bind:group={selectedVaults} />

				<label for={vault.id} class="inline-block w-full cursor-pointer">
					<p>{vault.data.label}</p>
					<p class="small">{vault.data.subLabel}</p>
				</label>
			</li>
		{/each}
	</ul>
	<ButtonAction variant="solid" size="sm" class="mt-4 w-full" callback={addVaultsToFlow}
		>Add Voults</ButtonAction
	>
</Modal>

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
</style>
