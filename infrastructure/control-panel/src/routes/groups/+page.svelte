<script lang="ts">
	import { goto } from '$app/navigation';
	import { TableCard, TableCardHeader } from '$lib/fragments';
	import { EVaultService } from '$lib/services/evaultService';
	import { Table } from '$lib/ui';
	import type { EVault } from '../api/evaults/+server';
	import { onMount } from 'svelte';

	let searchValue = $state('');
	let groups = $state<EVault[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let currentPage = $state(1);
	let itemsPerPage = $state(10);
	let totalPages = $state(1);

	const filtered = $derived(() => {
		if (!searchValue.trim()) return groups;
		const q = searchValue.toLowerCase();
		return groups.filter(
			(g) =>
				g.name?.toLowerCase().includes(q) ||
				g.ename?.toLowerCase().includes(q) ||
				g.evault?.toLowerCase().includes(q) ||
				g.id?.toLowerCase().includes(q)
		);
	});

	const paginated = $derived(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return filtered().slice(start, start + itemsPerPage);
	});

	$effect(() => {
		const n = Math.ceil(filtered().length / itemsPerPage) || 1;
		totalPages = n;
		if (currentPage > n) currentPage = n;
	});

	const tableData = $derived(() =>
		paginated().map((g) => ({
			Name: { type: 'text' as const, value: g.name || g.ename || g.evault || 'N/A' },
			'eName (w3id)': { type: 'text' as const, value: g.ename || 'N/A' },
			URI: {
				type: 'link' as const,
				value: g.serviceUrl || g.uri || 'N/A',
				link: g.serviceUrl || g.uri || '#',
				external: true
			}
		}))
	);

	async function loadGroups() {
		try {
			isLoading = true;
			error = null;
			groups = await EVaultService.getGroupEVaults();
		} catch (e) {
			error = 'Failed to load group eVaults';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	function handleRowClick(index: number) {
		const g = paginated()[index];
		if (!g) return;
		const id = g.evault || g.ename || g.id;
		goto(`/groups/${encodeURIComponent(id)}`);
	}

	onMount(loadGroups);
</script>

<svelte:head>
	<title>Group eVaults — Control Panel</title>
</svelte:head>

<div class="mb-6">
	<h1 class="text-2xl font-bold text-gray-900">Group eVaults</h1>
	<p class="mt-1 text-gray-600">
		Registry entries with a readable group manifest. Open a row for members and message stats.
	</p>
</div>

<TableCard>
	<TableCardHeader
		title="Groups"
		placeholder="Search by name or eName"
		bind:searchValue
		rightTitle={filtered().length > 0 ? `${filtered().length} group(s)` : ''}
	/>
	{#if isLoading}
		<div class="flex justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
		</div>
	{:else if error}
		<div class="py-8 text-center text-red-600">
			{error}
			<button
				type="button"
				class="ml-3 rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
				onclick={loadGroups}
			>
				Retry
			</button>
		</div>
	{:else if groups.length === 0}
		<div class="py-10 text-center text-gray-500">No group eVaults found.</div>
	{:else}
		<Table
			class="mb-4"
			tableData={tableData()}
			handleSelectedRow={handleRowClick}
			withPagination={false}
		/>
		<div class="mb-4 flex items-center justify-between text-sm text-gray-600">
			<span>
				Showing {(currentPage - 1) * itemsPerPage + 1} –
				{Math.min(currentPage * itemsPerPage, filtered().length)} of {filtered().length}
			</span>
			<div class="flex gap-2">
				<button
					type="button"
					class="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
					disabled={currentPage <= 1}
					onclick={() => currentPage--}
				>
					Previous
				</button>
				<span class="px-2 py-1">Page {currentPage} / {totalPages}</span>
				<button
					type="button"
					class="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
					disabled={currentPage >= totalPages}
					onclick={() => currentPage++}
				>
					Next
				</button>
			</div>
		</div>
	{/if}
</TableCard>

<div class="mt-4">
	<button
		type="button"
		class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
		onclick={loadGroups}
		disabled={isLoading}
	>
		Refresh
	</button>
</div>
