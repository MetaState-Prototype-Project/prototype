<script lang="ts">
	import { page } from '$app/stores';
	import { EVaultService } from '$lib/services/evaultService';
	import { onMount } from 'svelte';
	import type { EVault } from '../../api/evaults/+server';

	let evault = $state<EVault | null>(null);
	let logs = $state<string[]>([]);
	let details = $state<any>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let selectedTab = $state('logs');

	const evaultId = $page.params.evaultId;

	const fetchEVaultDetails = async () => {
		if (!evaultId) {
			error = 'Invalid evault ID';
			return;
		}

		try {
			isLoading = true;
			error = null;

			// First get the evault info to display
			const evaults = await EVaultService.getEVaults();
			evault = evaults.find((e) => e.id === evaultId || e.evault === evaultId) || null;

			if (!evault) {
				error = 'eVault not found';
				isLoading = false;
				return;
			}

			// Fetch logs and details in parallel
			const [logsData, detailsData] = await Promise.all([
				EVaultService.getEVaultLogs(evaultId, 100),
				EVaultService.getEVaultDetails(evaultId)
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
			eVault: {evault?.name || evaultId || 'Unknown'}
		</h1>
		<p class="text-gray-600">
			ID: {evaultId || 'Unknown'}
		</p>
		{#if evault}
			<p class="text-sm text-gray-500">
				URI: {evault.uri}
			</p>
		{/if}
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
			</nav>
		</div>

		<!-- Tab Content -->
		{#if selectedTab === 'logs'}
			<div class="rounded-lg bg-white p-6 shadow">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-lg font-semibold text-gray-900">eVault Logs</h3>
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
					{#if logs.length === 0}
						<div class="text-gray-500">No logs available</div>
					{:else}
						{#each logs as log}
							<div class="mb-1">{log}</div>
						{/each}
					{/if}
				</div>
			</div>
		{:else if selectedTab === 'details'}
			<div class="rounded-lg bg-white p-6 shadow">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">eVault Details</h3>
				<div class="rounded-lg bg-gray-50 p-4">
					{#if details}
						<dl class="space-y-2">
							<div>
								<dt class="font-medium text-gray-700">eName (w3id):</dt>
								<dd class="text-gray-900">{details.ename || 'N/A'}</dd>
							</div>
							<div>
								<dt class="font-medium text-gray-700">eVault ID:</dt>
								<dd class="text-gray-900">{details.evault || 'N/A'}</dd>
							</div>
							<div>
								<dt class="font-medium text-gray-700">URI:</dt>
								<dd class="text-gray-900">{details.uri || 'N/A'}</dd>
							</div>
							<div>
								<dt class="font-medium text-gray-700">Health Status:</dt>
								<dd class="text-gray-900">
									<span
										class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {details.healthStatus ===
										'Healthy'
											? 'bg-green-100 text-green-800'
											: details.healthStatus === 'Unhealthy'
												? 'bg-yellow-100 text-yellow-800'
												: 'bg-red-100 text-red-800'}"
									>
										{details.healthStatus || 'Unknown'}
									</span>
								</dd>
							</div>
							{#if details.originalUri && details.originalUri !== details.uri}
								<div>
									<dt class="font-medium text-gray-700">Original URI:</dt>
									<dd class="text-gray-900">{details.originalUri}</dd>
								</div>
								<div>
									<dt class="font-medium text-gray-700">Resolved:</dt>
									<dd class="text-gray-900">{details.resolved ? 'Yes' : 'No'}</dd>
								</div>
							{/if}
						</dl>
					{:else}
						<p class="text-gray-500">No details available</p>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>
