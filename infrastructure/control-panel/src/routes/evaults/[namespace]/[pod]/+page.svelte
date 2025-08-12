<script lang="ts">
	import { page } from '$app/stores';
	import { EVaultService } from '$lib/services/evaultService';
	import { onMount } from 'svelte';
	import type { EVault } from '../../../api/evaults/+server';

	let evault: EVault | null = null;
	let logs: string[] = [];
	let details: any = null;
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let selectedTab = $state('logs');

	const namespace = $page.params.namespace;
	const podName = $page.params.pod;

	const fetchEVaultDetails = async () => {
		if (!namespace || !podName) {
			error = 'Invalid namespace or pod name';
			return;
		}

		try {
			isLoading = true;
			error = null;

			const [logsData, detailsData] = await Promise.all([
				EVaultService.getEVaultLogs(namespace, podName),
				EVaultService.getEVaultDetails(namespace, podName)
			]);

			logs = logsData;
			details = detailsData;
		} catch (err) {
			error = 'Failed to fetch eVault details';
			console.error('Error fetching eVault details:', err);
		} finally {
			isLoading = false;
		}
	};

	const refreshData = () => {
		fetchEVaultDetails();
	};

	onMount(() => {
		fetchEVaultDetails();
	});
</script>

<div class="container mx-auto px-4 py-8">
	<div class="mb-6">
		<h1 class="mb-2 text-3xl font-bold text-gray-900">
			eVault: {podName || 'Unknown'}
		</h1>
		<p class="text-gray-600">
			Namespace: {namespace || 'Unknown'}
		</p>
	</div>

	{#if isLoading}
		<div class="flex justify-center py-8">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
		</div>
	{:else if error}
		<div class="py-8 text-center text-red-500">
			{error}
			<button
				onclick={refreshData}
				class="ml-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
			>
				Retry
			</button>
		</div>
	{:else}
		<!-- Tab Navigation -->
		<div class="mb-6 border-b border-gray-200">
			<nav class="-mb-px flex space-x-8">
				<button
					class="border-b-2 px-1 py-2 text-sm font-medium {selectedTab === 'logs'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
					onclick={() => (selectedTab = 'logs')}
				>
					Logs
				</button>
				<button
					class="border-b-2 px-1 py-2 text-sm font-medium {selectedTab === 'details'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
					onclick={() => (selectedTab = 'details')}
				>
					Details
				</button>
				<button
					class="border-b-2 px-1 py-2 text-sm font-medium {selectedTab === 'metrics'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
					onclick={() => (selectedTab = 'metrics')}
				>
					Metrics
				</button>
			</nav>
		</div>

		<!-- Tab Content -->
		{#if selectedTab === 'logs'}
			<div class="rounded-lg bg-white p-6 shadow">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-lg font-semibold text-gray-900">Pod Logs</h3>
					<button
						onclick={refreshData}
						class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
					>
						Refresh
					</button>
				</div>
				<div
					class="max-h-96 overflow-auto rounded-lg bg-gray-900 p-4 font-mono text-sm text-green-400"
				>
					{#each logs as log}
						<div class="mb-1">{log}</div>
					{/each}
				</div>
			</div>
		{:else if selectedTab === 'details'}
			<div class="rounded-lg bg-white p-6 shadow">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Pod Details</h3>
				<div class="rounded-lg bg-gray-50 p-4">
					<pre class="max-h-96 overflow-auto text-sm">{details?.podInfo ||
							'No details available'}</pre>
				</div>
			</div>
		{:else if selectedTab === 'metrics'}
			<div class="rounded-lg bg-white p-6 shadow">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Pod Metrics</h3>
				{#if details?.metrics}
					<div class="rounded-lg bg-gray-50 p-4">
						<pre class="text-sm">{details.metrics}</pre>
					</div>
				{:else}
					<div class="py-8 text-center text-gray-500">
						Metrics not available. Make sure metrics-server is installed and running.
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
