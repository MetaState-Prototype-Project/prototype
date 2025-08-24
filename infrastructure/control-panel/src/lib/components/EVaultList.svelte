<script lang="ts">
	import { onMount } from 'svelte';
	import { EVaultService } from '../services/evaultService';
	import type { EVault } from '../../routes/api/evaults/+server';

	let evaults: EVault[] = [];
	let loading = false;
	let cacheStatus: any = null;
	let lastRefresh = '';

	// Load eVaults on component mount
	onMount(async () => {
		await loadEVaults();
		// Get cache status for debugging
		cacheStatus = EVaultService.getCacheStatus();
	});

	async function loadEVaults() {
		loading = true;
		try {
			// This will return cached data immediately and refresh in background
			evaults = await EVaultService.getEVaults();
			lastRefresh = new Date().toLocaleTimeString();
		} catch (error) {
			console.error('Failed to load eVaults:', error);
		} finally {
			loading = false;
		}
	}

	async function forceRefresh() {
		loading = true;
		try {
			// Force refresh and get fresh data
			evaults = await EVaultService.forceRefresh();
			lastRefresh = new Date().toLocaleTimeString();
			// Update cache status
			cacheStatus = EVaultService.getCacheStatus();
		} catch (error) {
			console.error('Failed to force refresh:', error);
		} finally {
			loading = false;
		}
	}

	async function clearCache() {
		await EVaultService.clearCache();
		cacheStatus = EVaultService.getCacheStatus();
		// Reload data
		await loadEVaults();
	}
</script>

<div class="p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold">eVault Control Panel</h1>
		<div class="flex gap-2">
			<button
				on:click={loadEVaults}
				disabled={loading}
				class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
			>
				{loading ? 'Loading...' : 'Refresh'}
			</button>
			<button
				on:click={forceRefresh}
				disabled={loading}
				class="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:opacity-50"
			>
				Force Refresh
			</button>
			<button
				on:click={clearCache}
				class="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
			>
				Clear Cache
			</button>
		</div>
	</div>

	<!-- Cache Status -->
	{#if cacheStatus}
		<div class="mb-6 rounded-lg bg-gray-100 p-4">
			<h3 class="mb-2 font-semibold">Cache Status</h3>
			<div class="grid grid-cols-3 gap-4 text-sm">
				<div>
					<strong>Last Updated:</strong><br />
					{new Date(cacheStatus.lastUpdated).toLocaleString()}
				</div>
				<div>
					<strong>Status:</strong><br />
					<span
						class="rounded px-2 py-1 text-xs {cacheStatus.isStale
							? 'bg-yellow-200 text-yellow-800'
							: 'bg-green-200 text-green-800'}"
					>
						{cacheStatus.isStale ? 'Stale' : 'Fresh'}
					</span>
				</div>
				<div>
					<strong>Cached Items:</strong><br />
					{cacheStatus.count} eVaults
				</div>
			</div>
		</div>
	{/if}

	<!-- Last Refresh Info -->
	{#if lastRefresh}
		<div class="mb-4 text-sm text-gray-600">
			Last refresh: {lastRefresh}
		</div>
	{/if}

	<!-- eVault List -->
	<div class="grid gap-4">
		{#if evaults.length === 0}
			<div class="py-8 text-center text-gray-500">
				{loading ? 'Loading eVaults...' : 'No eVaults found'}
			</div>
		{:else}
			{#each evaults as evault}
				<div class="rounded-lg border p-4 transition-shadow hover:shadow-md">
					<h3 class="text-lg font-semibold">{evault.name || 'Unnamed eVault'}</h3>
					<div class="mt-2 text-sm text-gray-600">
						<strong>Namespace:</strong>
						{evault.namespace}<br />
						<strong>Pod:</strong>
						{evault.podName}<br />
						<strong>Status:</strong>
						<span
							class="rounded px-2 py-1 text-xs {evault.status === 'Running'
								? 'bg-green-200 text-green-800'
								: 'bg-red-200 text-red-800'}"
						>
							{evault.status}
						</span>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
