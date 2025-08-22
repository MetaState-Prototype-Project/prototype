<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Cancel01FreeIcons,
		Database01FreeIcons,
		DatabaseSync01Icon
	} from '@hugeicons/core-free-icons';

	export let data: { label: string; subLabel: string; type?: string };
	export let selected = false;
</script>

<div
	class="vault-node-wrapper relative"
	class:highlight={selected}
	class:platform-node={data.type === 'platform'}
>
	<!-- <button class="absolute top-[10px] end-[10px]" onclick={handleCancel}>
      <HugeiconsIcon icon={Cancel01FreeIcons} size="15px"/>
    </button> -->
	<div class="vault-node-content" class:platform-split={data.type === 'platform'}>
		{#if data.type === 'platform'}
			<!-- Platform split layout: Web3 Adapter | Platform -->
			<div class="platform-cards-container">
				<div class="platform-card web3-adapter-card">
					<HugeiconsIcon icon={DatabaseSync01Icon} />
					<div class="vault-labels">
						<div class="vault-label">Web3 Adapter</div>
					</div>
				</div>
				<div class="platform-card platform-info-card">
					<HugeiconsIcon icon={Database01FreeIcons} />
					<div class="vault-labels">
						<div class="vault-label">{data.label}</div>
						<div class="vault-sub-label">{data.subLabel}</div>
					</div>
				</div>
			</div>
		{:else}
			<!-- Regular eVault layout -->
			<HugeiconsIcon icon={Database01FreeIcons} />
			<div class="vault-labels">
				<div class="vault-label">{data.label}</div>
				<div class="vault-sub-label">{data.subLabel}</div>
			</div>
		{/if}
	</div>

	<!-- Position handles based on node type -->
	{#if data.type === 'platform'}
		<!-- Platforms (right column): handles on the left edge for incoming connections -->
		<Handle type="target" position={Position.Left} class="vault-handle platform-handle" />
		<!-- Platforms can also have outgoing connections to eVaults -->
		<Handle type="source" position={Position.Left} class="vault-handle platform-handle" />
	{:else}
		<!-- eVaults (left column): handles on the right edge for incoming and outgoing connections -->
		<Handle type="target" position={Position.Right} class="vault-handle evault-handle" />
		<Handle type="source" position={Position.Right} class="vault-handle evault-handle" />
	{/if}
</div>

<style>
	.vault-node-wrapper {
		background-color: rgba(255, 255, 255, 0.9);
		border-radius: 12px;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(0, 0, 0, 0.05);
		min-width: 150px;
		color: #333;
		font-family: sans-serif;
		transition: all 0.3s ease;
	}

	/* Make platform cards wider for split layout */
	.vault-node-wrapper.platform-node {
		min-width: 280px;
		background-color: transparent;
		box-shadow: none;
		border: none;
		padding: 0;
	}

	.vault-node-wrapper.highlight {
		box-shadow: 0 0 20px rgba(76, 175, 80, 0.6);
		border: 2px solid #4caf50;
		transform: scale(1.05);
	}

	.vault-node-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.vault-node-content.platform-split {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 0;
		width: 100%;
	}

	.platform-cards-container {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		width: 100%;
		position: relative;
		background: transparent;
		border: 2px dotted #e5e5e5;
		border-radius: 12px;
		padding: 4px;
	}

	.platform-card {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 12px 16px;
		background: white;
		border-radius: 8px;
		margin: 2px;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
		border: 1px solid rgba(0, 0, 0, 0.05);
	}

	.web3-adapter-card {
		border-right: 1px solid #e5e5e5;
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}

	.platform-info-card {
		border-left: 1px solid #e5e5e5;
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}

	.vault-labels {
		text-align: center;
	}

	.vault-label {
		font-weight: 600;
		font-size: 1.1em;
		margin-bottom: 2px;
	}

	/* Web3 Adapter text should match platform name size */
	.web3-adapter-card .vault-label {
		font-size: 0.9em;
		font-weight: 600;
	}

	.vault-sub-label {
		font-size: 0.85em;
		color: #666;
	}

	:global(.vault-handle) {
		width: 10px;
		height: 10px;
		background: #4caf50;
		border: 2px solid #fff;
		position: absolute;
		border-radius: 50%;
		transform: translate(-50%, -50%);
	}

	:global(.evault-handle) {
		top: 50%;
		bottom: auto;
		right: -5px;
		left: auto;
		transform: translateY(-50%);
	}

	:global(.platform-handle) {
		top: 50%;
		bottom: auto;
		left: -5px;
		right: auto;
		transform: translateY(-50%);
	}

	/* Platform node handles should be on the border of the transparent container */
	.platform-node :global(.platform-handle) {
		left: -5px;
		right: auto;
	}

	/* Fix handle positioning for Svelte Flow */
	:global(.vault-handle[data-handlepos='right']) {
		top: 50% !important;
		bottom: auto !important;
		right: -5px !important;
		left: auto !important;
		transform: translateY(-50%) !important;
	}

	:global(.vault-handle[data-handlepos='left']) {
		top: 50% !important;
		bottom: auto !important;
		left: -5px !important;
		right: auto !important;
		transform: translateY(-50%) !important;
	}
</style>
