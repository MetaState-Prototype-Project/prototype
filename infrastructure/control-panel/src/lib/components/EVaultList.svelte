<script lang="ts">
	import { onMount } from 'svelte';
	import { EVaultService } from '../services/evaultService';
	import type { EVault } from '../../routes/api/evaults/+server';

	let evaults: EVault[] = [];
	let loading = true;
	let error: string | null = null;
	let cacheStatus: { lastUpdated: number; isStale: boolean; itemCount: number };

	onMount(async () => {
		console.log('Component mounted, starting to load eVaults...');
		try {
			loading = true;
			console.log('Loading state set to true');
			await loadEVaults();
			cacheStatus = EVaultService.getCacheStatus();
			console.log('Loaded eVaults:', evaults.length, 'items');
		} catch (err) {
			error = 'Failed to load eVaults';
			console.error('Error in onMount:', err);
		} finally {
			loading = false;
			console.log('Loading state set to false');
		}
	});

	async function loadEVaults() {
		console.log('loadEVaults called');
		try {
			evaults = await EVaultService.getEVaults();
			console.log('EVaultService returned:', evaults.length, 'items');
			cacheStatus = EVaultService.getCacheStatus();
		} catch (err) {
			console.error('Error loading eVaults:', err);
			throw err;
		}
	}

	async function forceRefresh() {
		try {
			loading = true;
			evaults = await EVaultService.forceRefresh();
			cacheStatus = EVaultService.getCacheStatus();
		} catch (err) {
			error = 'Failed to refresh eVaults';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	async function clearCache() {
		try {
			await EVaultService.clearCache();
			evaults = [];
			cacheStatus = EVaultService.getCacheStatus();
		} catch (err) {
			console.error('Error clearing cache:', err);
		}
	}

	function formatTimestamp(timestamp: number): string {
		if (timestamp === 0) return 'Never';
		return new Date(timestamp).toLocaleString();
	}
</script>

<div class="p-6">
	<div class="mb-6">
		<h1 class="mb-4 text-2xl font-bold text-gray-900">eVault Management</h1>

		<!-- Cache Status -->
		<div class="mb-4 rounded-lg bg-gray-50 p-4">
			<h3 class="mb-2 text-sm font-medium text-gray-700">Cache Status</h3>
			<div class="grid grid-cols-3 gap-4 text-sm">
				<div>
					<span class="text-gray-500">Last Updated:</span>
					<span class="ml-2 font-mono"
						>{formatTimestamp(cacheStatus?.lastUpdated || 0)}</span
					>
				</div>
				<div>
					<span class="text-gray-500">Status:</span>
					<span
						class="ml-2 {cacheStatus?.isStale
							? 'text-orange-600'
							: 'text-green-600'} font-medium"
					>
						{cacheStatus?.isStale ? 'Stale' : 'Fresh'}
					</span>
				</div>
				<div>
					<span class="text-gray-500">Items:</span>
					<span class="ml-2 font-mono">{cacheStatus?.itemCount || 0}</span>
				</div>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="mb-6 flex gap-3">
			<button
				on:click={loadEVaults}
				disabled={loading}
				class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
			>
				{loading ? 'Loading...' : 'Refresh'}
			</button>

			<button
				on:click={forceRefresh}
				disabled={loading}
				class="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
			>
				Force Refresh
			</button>

			<button
				on:click={clearCache}
				class="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
			>
				Clear Cache
			</button>
		</div>
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
			{error}
		</div>
	{/if}

	<!-- Loading State -->
	{#if loading}
		<div class="py-8 text-center">
			<div
				class="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"
			></div>
			<p class="mt-2 text-gray-600">Loading eVaults...</p>
		</div>
	{:else if evaults.length === 0}
		<!-- Empty State -->
		<div class="py-8 text-center">
			<p class="text-gray-500">No eVaults found</p>
			<p class="mt-1 text-sm text-gray-400">
				Try refreshing or check your Kubernetes connection
			</p>
		</div>
	{:else}
		<!-- eVault List -->
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							Name
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							Namespace
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							Status
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							Age
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							Service URL
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white">
					{#each evaults as evault}
						<tr class="hover:bg-gray-50">
							<td
								class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900"
							>
								{evault.name}
							</td>
							<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
								{evault.namespace}
							</td>
							<td class="whitespace-nowrap px-6 py-4">
								<span
									class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {evault.status ===
									'Running'
										? 'bg-green-100 text-green-800'
										: evault.status === 'Pending'
											? 'bg-yellow-100 text-yellow-800'
											: 'bg-red-100 text-red-800'}"
								>
									{evault.status}
								</span>
							</td>
							<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
								{evault.age || 'Unknown'}
							</td>
							<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
								{#if evault.serviceUrl}
									<a
										href={evault.serviceUrl}
										target="_blank"
										rel="noopener noreferrer"
										class="text-blue-600 underline hover:text-blue-800"
									>
										{evault.serviceUrl}
									</a>
								{:else}
									<span class="text-gray-400">No external access</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
