<script lang="ts">
	import { page } from '$app/stores';
	import { EVaultService } from '$lib/services/evaultService';
	import { onMount } from 'svelte';
	import type { BindingDocument, SocialConnection } from '@metastate-foundation/types';
	import type { EVault } from '../../api/evaults/+server';

	let evault = $state<EVault | null>(null);
	let logs = $state<string[]>([]);
	let details = $state<any>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let selectedTab = $state('logs');

	let bindingDocumentsLoading = $state(false);
	let bindingDocumentsError = $state<string | null>(null);
	let documents = $state<BindingDocument[]>([]);
	let socialConnections = $state<SocialConnection[]>([]);

	const evaultId = $page.params.evaultId;

	function getDataValue(data: Record<string, unknown>, key: string): string {
		const value = data[key];
		return typeof value === 'string' ? value : 'N/A';
	}

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

	const fetchBindingDocuments = async () => {
		if (!evaultId) return;

		bindingDocumentsLoading = true;
		bindingDocumentsError = null;
		try {
			const result = await EVaultService.getBindingDocuments(evaultId);
			documents = result.documents;
			socialConnections = result.socialConnections;
		} catch (err) {
			bindingDocumentsError =
				err instanceof Error ? err.message : 'Failed to fetch binding documents';
		} finally {
			bindingDocumentsLoading = false;
		}
	};

	const refreshData = () => {
		fetchEVaultDetails();
		if (selectedTab === 'binding-documents') {
			fetchBindingDocuments();
		}
	};

	const selectTab = (tab: string) => {
		selectedTab = tab;
		if (tab === 'binding-documents') {
			fetchBindingDocuments();
		}
	};

	onMount(() => {
		fetchEVaultDetails();
	});

	let idDocuments = $derived(documents.filter((doc) => doc.type === 'id_document'));
	let selfDocuments = $derived(documents.filter((doc) => doc.type === 'self'));
	let photoDocuments = $derived(documents.filter((doc) => doc.type === 'photograph'));
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
					onclick={() => selectTab('logs')}
				>
					Logs
				</button>
				<button
					class="border-b-2 px-1 py-2 text-sm font-medium {selectedTab === 'details'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
					onclick={() => selectTab('details')}
				>
					Details
				</button>
				<button
					class="border-b-2 px-1 py-2 text-sm font-medium {selectedTab === 'binding-documents'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
					onclick={() => selectTab('binding-documents')}
				>
					Binding Documents
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
		{:else if selectedTab === 'binding-documents'}
			<div class="rounded-lg bg-white p-6 shadow">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Binding Documents</h3>
				{#if bindingDocumentsLoading}
					<p class="text-slate-600">Loading binding documents...</p>
				{:else if bindingDocumentsError}
					<p class="rounded-md bg-red-50 p-3 text-red-700">{bindingDocumentsError}</p>
					<button
						onclick={fetchBindingDocuments}
						class="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
					>
						Retry
					</button>
				{:else}
					<section class="mt-6 grid gap-4 lg:grid-cols-3">
						<div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
							<h2 class="text-lg font-semibold">Photographs</h2>
							{#if photoDocuments.length === 0}
								<p class="mt-2 text-sm text-slate-500">No photograph binding documents.</p>
							{:else}
								<div class="mt-4 space-y-4">
									{#each photoDocuments as doc}
										<div class="rounded-md border border-slate-200 p-3">
											<p class="text-xs text-slate-500">ID: {doc.id}</p>
											<img
												class="mt-2 max-h-[100px] w-full rounded object-contain"
												src={getDataValue(doc.data, 'photoBlob')}
												alt="Binding"
											/>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
							<h2 class="text-lg font-semibold">ID Document</h2>
							{#if idDocuments.length === 0}
								<p class="mt-2 text-sm text-slate-500">No id_document binding documents.</p>
							{:else}
								<table class="mt-4 w-full text-left text-sm">
									<thead class="bg-slate-50 text-slate-600">
										<tr>
											<th class="px-3 py-2">Vendor</th>
											<th class="px-3 py-2">Reference</th>
											<th class="px-3 py-2">Name</th>
										</tr>
									</thead>
									<tbody>
										{#each idDocuments as doc}
											<tr class="border-t border-slate-200">
												<td class="px-3 py-2">{getDataValue(doc.data, 'vendor')}</td>
												<td class="px-3 py-2">{getDataValue(doc.data, 'reference')}</td>
												<td class="px-3 py-2">{getDataValue(doc.data, 'name')}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						</div>

						<div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
							<h2 class="text-lg font-semibold">Self Binding</h2>
							{#if selfDocuments.length === 0}
								<p class="mt-2 text-sm text-slate-500">No self binding documents.</p>
							{:else}
								<table class="mt-4 w-full text-left text-sm">
									<thead class="bg-slate-50 text-slate-600">
										<tr>
											<th class="px-3 py-2">Name</th>
											<th class="px-3 py-2">Subject</th>
										</tr>
									</thead>
									<tbody>
										{#each selfDocuments as doc}
											<tr class="border-t border-slate-200">
												<td class="px-3 py-2">{getDataValue(doc.data, 'name')}</td>
												<td class="px-3 py-2">{doc.subject}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						</div>
					</section>

					<section class="mt-6">
						<div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
							<h2 class="text-lg font-semibold">Social Connections</h2>
							{#if socialConnections.length === 0}
								<p class="mt-2 text-sm text-slate-500">No social connections found.</p>
							{:else}
								<div class="mt-4 space-y-3">
									{#each socialConnections as connection}
										<div class="rounded-md border border-slate-200 p-3">
											<p class="font-medium text-gray-900">{connection.name}</p>
											<p class="text-sm text-slate-600">
												Witness eName: {connection.witnessEName || 'Unknown'}
											</p>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</section>
				{/if}
			</div>
		{/if}
	{/if}
</div>
