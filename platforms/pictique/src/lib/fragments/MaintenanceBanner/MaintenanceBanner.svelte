<script lang="ts">
	import { onMount } from 'svelte';
	import axios from 'axios';
	import { PUBLIC_REGISTRY_URL } from '$env/static/public';

	let motd = $state<{ status: 'up' | 'maintenance'; message: string } | null>(null);

	onMount(async () => {
		try {
			const registryUrl = PUBLIC_REGISTRY_URL || 'http://localhost:4321';
			const response = await axios.get(`${registryUrl}/motd`);
			motd = response.data;
		} catch (error) {
			console.error('Failed to fetch motd:', error);
		}
	});
</script>

{#if motd?.status === 'maintenance'}
	<div class="bg-yellow-500 px-4 py-3 text-center text-sm font-medium text-black">
		⚠️ {motd.message}
	</div>
{/if}
