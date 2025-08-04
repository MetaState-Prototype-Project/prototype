<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Cancel01FreeIcons, Database01FreeIcons } from '@hugeicons/core-free-icons';

	export let data: { label: string; subLabel: string };
</script>

<div class="vault-node-wrapper relative">
	<!-- <button class="absolute top-[10px] end-[10px]" onclick={handleCancel}>
      <HugeiconsIcon icon={Cancel01FreeIcons} size="15px"/>
    </button> -->
	<div class="vault-node-content">
		<HugeiconsIcon icon={Database01FreeIcons} />
		<div class="vault-labels">
			<div class="vault-label">{data.label}</div>
			<div class="vault-sub-label">{data.subLabel}</div>
		</div>
	</div>
	<Handle type="source" position={Position.Bottom} class="vault-handle" />
	<Handle type="target" position={Position.Top} class="vault-handle" />
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
	}

	.vault-node-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.vault-labels {
		text-align: center;
	}

	.vault-label {
		font-weight: 600;
		font-size: 1.1em;
		margin-bottom: 2px;
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
		top: auto;
		bottom: -5px;
		left: 50%;
		transform: translateX(-50%);
	}
	:global(.vault-handle[data-position='top']) {
		top: -5px;
		bottom: auto;
	}
</style>
