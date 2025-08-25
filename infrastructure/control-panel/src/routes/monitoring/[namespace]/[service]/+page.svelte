<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EVaultService } from '$lib/services/evaultService';

	// Debug: Check if methods exist
	console.log('🔍 EVaultService imported:', EVaultService);
	console.log('🔍 getEVaultLogs exists:', typeof EVaultService.getEVaultLogs);
	console.log('🔍 getEVaultMetrics exists:', typeof EVaultService.getEVaultMetrics);

	// Temporary workaround: Add methods directly if they don't exist
	if (!EVaultService.getEVaultLogs) {
		console.log('⚠️ Adding getEVaultLogs method directly');
		EVaultService.getEVaultLogs = async (namespace: string, podName: string) => {
			console.log('🔍 Direct getEVaultLogs called with:', { namespace, podName });
			try {
				const response = await fetch(
					`/api/evaults/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/logs`
				);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const responseData = await response.json();
				console.log('✅ Direct logs fetched successfully:', responseData);
				return responseData.logs || [];
			} catch (error) {
				console.error('❌ Direct logs fetch failed:', error);
				throw error;
			}
		};
	}

	if (!EVaultService.getEVaultMetrics) {
		console.log('⚠️ Adding getEVaultMetrics method directly');
		EVaultService.getEVaultMetrics = async (namespace: string, podName: string) => {
			console.log('🔍 Direct getEVaultMetrics called with:', { namespace, podName });
			try {
				const response = await fetch(
					`/api/evaults/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/metrics`
				);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const responseData = await response.json();
				console.log('✅ Direct metrics fetched successfully:', responseData);
				return responseData.metrics || {};
			} catch (error) {
				console.error('❌ Direct metrics fetch failed:', error);
				throw error;
			}
		};
	}
	import { ButtonAction } from '$lib/ui';
	import { RefreshCw, Clock, Activity, Server, Globe, ArrowLeft } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	interface PageData {
		namespace: string;
		service: string;
	}

	export let data: PageData;

	let logs = '';
	let isLoading = true;
	let error = '';
	let refreshInterval: NodeJS.Timeout;
	let activeTab = 'logs';
	let evaultData: any = null;
	let lastLogTimestamp = '';
	let logLines: string[] = [];
	let metricsData: any = null;
	let metricsLoading = false;

	// Add null checks for data
	const namespace = data?.namespace || '';
	const service = data?.service || '';
	const evaultId = namespace ? namespace.replace('evault-', '') : '';

	async function fetchEVaultData() {
		console.log('fetchEVaultData called');
		try {
			console.log('Calling EVaultService.getEVaults()...');
			const evaults = await EVaultService.getEVaults();
			console.log('Got evaults:', evaults);
			evaultData = evaults.find(
				(ev: any) => ev.namespace === namespace && ev.name === service
			);
			console.log('Found evault data:', evaultData);
		} catch (err) {
			console.error('Error fetching eVault data:', err);
		}
	}

	async function fetchLogs() {
		console.log('fetchLogs called');
		try {
			if (!namespace) {
				error = 'No namespace provided';
				console.log('No namespace, returning early');
				return;
			}

			if (!evaultData?.podName || evaultData.podName === 'N/A') {
				error = 'No pod found for this service';
				console.log('No pod found, returning early');
				return;
			}

			// Only set loading on first fetch
			if (logLines.length === 0) {
				isLoading = true;
			}

			console.log(
				'Calling EVaultService.getEVaultLogs with namespace:',
				namespace,
				'pod:',
				evaultData.podName
			);
			const logsArray = await EVaultService.getEVaultLogs(namespace, evaultData.podName);
			console.log('Got logs array:', logsArray);

			if (logsArray && logsArray.length > 0) {
				// Append new logs to existing ones
				const newLogs = logsArray.filter((line: string) => !logLines.includes(line));
				logLines = [...logLines, ...newLogs];

				// Keep only last 1000 lines to prevent memory issues
				if (logLines.length > 1000) {
					logLines = logLines.slice(-1000);
				}

				logs = logLines.join('\n');
			}
		} catch (err) {
			console.error('Error fetching logs:', err);
			error = 'Failed to fetch logs';
		} finally {
			isLoading = false;
		}
	}

	async function fetchMetrics() {
		if (!evaultData?.podName || evaultData.podName === 'N/A') {
			return;
		}

		try {
			metricsLoading = true;
			const metrics = await EVaultService.getEVaultMetrics(namespace, evaultData.podName);
			metricsData = metrics;
		} catch (err) {
			console.error('Error fetching metrics:', err);
		} finally {
			metricsLoading = false;
		}
	}

	function clearLogs() {
		logLines = [];
		logs = '';
		error = '';
	}

	function startAutoRefresh() {
		refreshInterval = setInterval(fetchLogs, 5000);
	}

	function stopAutoRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	}

	onMount(async () => {
		console.log('onMount called with namespace:', namespace, 'service:', service);
		// Start with clean state
		clearLogs();

		if (namespace) {
			console.log('Fetching eVault data...');
			await fetchEVaultData(); // Wait for this to complete
			console.log('Fetching logs...');
			await fetchLogs(); // Now this will have evaultData
			console.log('Fetching metrics...');
			await fetchMetrics(); // Get metrics data
			startAutoRefresh();
		} else {
			console.log('No namespace provided, skipping data fetch');
		}
	});

	onDestroy(() => {
		stopAutoRefresh();
	});
</script>

<svelte:head>
	<title>eVault {evaultId} - Control Panel</title>
</svelte:head>

<div class="container mx-auto space-y-6 p-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">eVault {evaultId}</h1>
			<p class="text-gray-600">Namespace: {namespace} | Service: {service}</p>
		</div>
		<div class="flex items-center space-x-3">
			<ButtonAction variant="soft" callback={fetchLogs}>
				<RefreshCw class="mr-2 h-4 w-4" />
				{isLoading ? 'Refreshing...' : 'Refresh'}
			</ButtonAction>
			<ButtonAction variant="soft" callback={clearLogs}>Clear Logs</ButtonAction>
			<ButtonAction variant="soft" callback={() => goto('/')}>
				<ArrowLeft class="mr-2 h-4 w-4" />
				Back to Dashboard
			</ButtonAction>
		</div>
	</div>

	<!-- eVault Info Cards -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<div class="mb-2 text-sm font-medium text-gray-500">eVault ID</div>
			<div class="flex items-center space-x-2">
				<Server class="h-4 w-4 text-blue-500" />
				<span class="text-lg font-semibold">{evaultId}</span>
			</div>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<div class="mb-2 text-sm font-medium text-gray-500">Namespace</div>
			<div class="flex items-center space-x-2">
				<Globe class="h-4 w-4 text-green-500" />
				<span class="text-lg font-semibold">{namespace}</span>
			</div>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<div class="mb-2 text-sm font-medium text-gray-500">Service</div>
			<div class="flex items-center space-x-2">
				<Activity class="h-4 w-4 text-purple-500" />
				<span class="text-lg font-semibold">{service}</span>
			</div>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<div class="mb-2 text-sm font-medium text-gray-500">Auto-refresh</div>
			<div class="flex items-center space-x-2">
				<Clock class="h-4 w-4 text-orange-500" />
				<span class="text-lg font-semibold">Every 5s</span>
			</div>
		</div>
	</div>

	<!-- Tab Navigation -->
	<div class="border-b border-gray-200">
		<nav class="-mb-px flex space-x-8">
			<button
				class="border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'logs'
					? 'border-blue-500 text-blue-600'
					: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				on:click={() => (activeTab = 'logs')}
			>
				Container Logs
			</button>
			<button
				class="border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'details'
					? 'border-blue-500 text-blue-600'
					: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				on:click={() => (activeTab = 'details')}
			>
				Details
			</button>
			<button
				class="border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'metrics'
					? 'border-blue-500 text-blue-600'
					: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				on:click={() => (activeTab = 'metrics')}
			>
				Metrics
			</button>
		</nav>
	</div>

	<!-- Tab Content -->
	{#if activeTab === 'logs'}
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<h3 class="mb-2 text-lg font-medium text-gray-900">eVault Container Logs</h3>
			<p class="mb-4 text-gray-600">
				Live logs from the eVault container. Auto-refreshing every 5 seconds.
			</p>

			{#if error}
				<div class="rounded-md bg-red-50 p-4 text-red-500">
					{error}
				</div>
			{:else}
				<div
					class="max-h-96 overflow-auto rounded-md bg-gray-900 p-4 font-mono text-sm text-green-400"
				>
					{#if isLoading}
						<div class="flex items-center space-x-2">
							<RefreshCw class="h-4 w-4 animate-spin" />
							<span>Loading logs...</span>
						</div>
					{:else if logs}
						<pre class="whitespace-pre-wrap">{logs}</pre>
					{:else}
						<span class="text-gray-400">No logs available</span>
					{/if}
				</div>
			{/if}
		</div>
	{:else if activeTab === 'details'}
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<h3 class="mb-2 text-lg font-medium text-gray-900">eVault Details</h3>
			<p class="mb-4 text-gray-600">Detailed information about this eVault instance.</p>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<div class="text-sm font-medium text-gray-500">Namespace</div>
					<p class="text-sm">{namespace}</p>
				</div>
				<div>
					<div class="text-sm font-medium text-gray-500">Service Name</div>
					<p class="text-sm">{service}</p>
				</div>
				<div>
					<div class="text-sm font-medium text-gray-500">eVault ID</div>
					<p class="text-sm">{evaultId}</p>
				</div>
				<div>
					<div class="text-sm font-medium text-gray-500">Pod Name</div>
					<p class="text-sm">{evaultData?.podName || 'Loading...'}</p>
				</div>
			</div>
		</div>
	{:else if activeTab === 'metrics'}
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-medium text-gray-900">eVault Metrics</h3>
				<ButtonAction variant="soft" callback={fetchMetrics} disabled={metricsLoading}>
					<RefreshCw class="mr-2 h-4 w-4" />
					{metricsLoading ? 'Refreshing...' : 'Refresh Metrics'}
				</ButtonAction>
			</div>

			{#if metricsLoading}
				<div class="py-8 text-center">
					<RefreshCw class="mx-auto mb-4 h-8 w-8 animate-spin text-blue-500" />
					<p class="text-gray-500">Loading metrics...</p>
				</div>
			{:else if metricsData}
				<div class="space-y-6">
					<!-- Resource Usage -->
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="rounded-lg bg-blue-50 p-4">
							<h4 class="mb-2 text-sm font-medium text-blue-900">CPU Usage</h4>
							<p class="text-2xl font-bold text-blue-600">
								{metricsData.resources?.cpu || 'N/A'}
							</p>
							{#if metricsData.resources?.note}
								<p class="mt-1 text-xs text-blue-600">
									{metricsData.resources.note}
								</p>
							{/if}
						</div>
						<div class="rounded-lg bg-green-50 p-4">
							<h4 class="mb-2 text-sm font-medium text-green-900">Memory Usage</h4>
							<p class="text-2xl font-bold text-green-600">
								{metricsData.resources?.memory || 'N/A'}
							</p>
							{#if metricsData.resources?.note}
								<p class="mt-1 text-xs text-green-600">
									{metricsData.resources.note}
								</p>
							{/if}
						</div>
					</div>

					<!-- Pod Status -->
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="rounded-lg bg-indigo-50 p-4">
							<h4 class="mb-2 text-sm font-medium text-indigo-900">Pod Status</h4>
							<p class="text-2xl font-bold text-indigo-600">
								{metricsData.status?.podStatus || 'Unknown'}
							</p>
						</div>
						<div class="rounded-lg bg-teal-50 p-4">
							<h4 class="mb-2 text-sm font-medium text-teal-900">Pod Age</h4>
							<p class="text-2xl font-bold text-teal-600">
								{metricsData.status?.podAge || 'N/A'}
							</p>
						</div>
					</div>

					<!-- Log Statistics -->
					<div class="rounded-lg bg-gray-50 p-4">
						<h4 class="mb-3 text-sm font-medium text-gray-900">Log Statistics</h4>
						<div class="grid grid-cols-3 gap-4 text-center">
							<div>
								<p class="text-2xl font-bold text-gray-900">
									{metricsData.logs?.totalLines || 0}
								</p>
								<p class="text-sm text-gray-600">Total Lines</p>
							</div>
							<div>
								<p class="text-2xl font-bold text-red-600">
									{metricsData.logs?.errorCount || 0}
								</p>
								<p class="text-sm text-gray-600">Errors</p>
							</div>
							<div>
								<p class="text-2xl font-bold text-yellow-600">
									{metricsData.logs?.warningCount || 0}
								</p>
								<p class="text-sm text-gray-600">Warnings</p>
							</div>
						</div>
						{#if metricsData.logs?.lastUpdate}
							<p class="mt-2 text-center text-xs text-gray-500">
								Last updated: {new Date(
									metricsData.logs.lastUpdate
								).toLocaleTimeString()}
							</p>
						{/if}
					</div>

					<!-- Pod Status -->
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<!-- Events -->
						<div class="rounded-lg bg-orange-50 p-4">
							<h4 class="mb-2 text-sm font-medium text-orange-900">Recent Events</h4>
							{#if metricsData.status?.events && metricsData.status.events.length > 0}
								<div class="space-y-1">
									{#each metricsData.status.events as event}
										<p class="text-xs text-orange-800">{event}</p>
									{/each}
								</div>
							{:else}
								<p class="text-xs text-orange-600">No recent events</p>
							{/if}
						</div>

						<!-- Conditions -->
						<div class="rounded-lg bg-purple-50 p-4">
							<h4 class="mb-2 text-sm font-medium text-purple-900">Pod Conditions</h4>
							{#if metricsData.status?.conditions && metricsData.status.conditions.length > 0}
								<div class="space-y-1">
									{#each metricsData.status.conditions as condition}
										<p class="text-xs text-purple-800">{condition}</p>
									{/each}
								</div>
							{:else}
								<p class="text-xs text-purple-600">No conditions available</p>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<div class="py-8 text-center text-gray-500">
					<Activity class="mx-auto mb-4 h-12 w-12 text-gray-300" />
					<p>No metrics available</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
