<script lang="ts">
  import { onMount } from 'svelte';
  import '@xyflow/svelte/dist/style.css';
  import type { Node, Edge, NodeTypes } from '@xyflow/svelte';

  import {Logs, VaultNode} from '$lib/fragments';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PauseFreeIcons, PlayFreeIcons } from '@hugeicons/core-free-icons';
  

  let SvelteFlowComponent: typeof import('@xyflow/svelte').SvelteFlow | null = $state(null);

  const customNodeTypes: NodeTypes = {
      vault: VaultNode,
  };

  let isPaused = $state(false);

  let nodes: Node[] = $state([
      {
          id: '1',
          position: { x: 100, y: 50 }, 
          data: { label: 'Alice', subLabel: 'alice.vault.dev' },
          type: 'vault',
      },
      {
          id: '2',
          position: { x: 300, y: 150 }, 
          data: { label: 'Pictique', subLabel: 'pictique.com' }, 
          type: 'vault',
      },
      {
          id: '3',
          position: { x: 500, y: 50 }, 
          data: { label: 'Bob', subLabel: 'bob.vault.dev' },
          type: 'vault',
      },
      {
          id: '4',
          position: { x: 800, y: 50 }, 
          data: { label: 'xyz', subLabel: 'xyz.vault.dev' },
          type: 'vault',
      },
  ]);

  let edges: Edge[] = $derived(
    nodes.flatMap((node, index, arr) => {
        if (index < arr.length - 1) {
            return [{
                id: `e${node.id}-${arr[index + 1].id}`,
                source: node.id,
                target: arr[index + 1].id,
                animated: !isPaused,
                type: 'smoothstep',
                style: 'stroke: #4CAF50; stroke-width: 2;',
            }];
        }
        return [];
    })
  );

  let currentSelectedEventIndex = $state(-1);

	const events = [
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

  onMount(async () => {
      const mod = await import('@xyflow/svelte');
      SvelteFlowComponent = mod.SvelteFlow;
  });
</script>

<section class="w-full h-full flex">
  <div class="w-screen h-screen flex flex-col bg-gray">
    <div class="w-full flex justify-between items-center p-4 bg-white shadow-sm z-10">
      <h4 class="text-xl text-gray-800 font-semibold">Live Monitoring</h4>
    <button
      onclick={() => isPaused = !isPaused}
      class="px-4 py-2 flex items-center gap-2 text-base font-geist font-medium text-gray-700 bg-white border border-[#e5e5e5] rounded-full shadow-md hover:bg-gray-50 transition-colors"
    >
        {#if isPaused}
        <HugeiconsIcon icon={PlayFreeIcons} size="20px"/>
        {:else}
        <HugeiconsIcon icon={PauseFreeIcons} size="20px"/>
        {/if}
        {isPaused ? 'Resume Live Feed' : 'Pause Live Feed'}
    </button>
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
  <div class="flex-grow flex justify-center items-center text-gray-700">Loading flow chart...</div>
  {/if}
</div>
<Logs class="w-[40%]" {events} bind:activeEventIndex={currentSelectedEventIndex} />
</section>

<style>
  :global(.svelte-flow__edge-path) {
      stroke: #4CAF50 !important;
      stroke-width: 2 !important;
  }

  :global(.svelte-flow__edge.animated .svelte-flow__edge-path) {
    stroke-dasharray: 5 5; 
  }

  :global(.svelte-flow) {
      background-color: transparent !important;
  }
</style>