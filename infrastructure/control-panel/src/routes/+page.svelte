<script lang="ts">
	import { TableCard, TableCardHeader } from '$lib/fragments';
	import { Table } from '$lib/ui';
	import { EVaultService } from '$lib/services/evaultService';
	import { registryService } from '$lib/services/registry';
	import type { EVault } from './api/evaults/+server';
	import type { Platform } from '$lib/services/registry';
	import { onMount } from 'svelte';
	import { RefreshCw } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	let evaultsSearchValue = $state('');
	let platformsSearchQuery = $state('');
	let evaults = $state<EVault[]>([]);
	let platforms = $state<Platform[]>([]);
	let isLoading = $state(true);
	let platformsLoading = $state(true);
	let error = $state<string | null>(null);
	let platformsError = $state<string | null>(null);
	let mappedData = $state<any[]>([]);

	// Track selected items
	let selectedEVaults = $state<number[]>([]);
	let selectedPlatforms = $state<number[]>([]);

	const mappedPlatformsData = $derived(
		platforms.map((platform) => ({
			Name: {
				type: 'text',
				value: platform.name
			},
			Status: {
				type: 'text',
				value: platform.status
			},
			Uptime: {
				type: 'text',
				value: platform.uptime
			},
			URL: {
				type: 'link',
				value: platform.url,
				link: platform.url,
				external: true
			}
		}))
	);

	const handlePreviousPage = async () => {
		alert('Previous btn clicked. Make a call to your server to fetch data.');
	};

	const handleNextPage = async () => {
		alert('Next btn clicked. Make a call to your server to fetch data.');
	};

	const tableHeadings = ['eName', 'Uptime', 'IP', 'URI'];

	const pages = [
		{ name: '1', href: '#' },
		{ name: '2', href: '#' },
		{ name: '3', href: '#' }
	];

	// Handle eVault selection changes
	function handleEVaultSelectionChange(index: number, checked: boolean) {
		if (checked) {
			selectedEVaults = [...selectedEVaults, index];
		} else {
			selectedEVaults = selectedEVaults.filter((i) => i !== index);
		}

		// Store selections immediately in sessionStorage
		const selectedEVaultData = selectedEVaults.map((i) => evaults[i]);
		sessionStorage.setItem('selectedEVaults', JSON.stringify(selectedEVaultData));
	}

	// Handle platform selection changes
	function handlePlatformSelectionChange(index: number, checked: boolean) {
		if (checked) {
			selectedPlatforms = [...selectedPlatforms, index];
		} else {
			selectedPlatforms = selectedPlatforms.filter((i) => i !== index);
		}

		// Store selections immediately in sessionStorage
		const selectedPlatformData = selectedPlatforms.map((i) => platforms[i]);
		sessionStorage.setItem('selectedPlatforms', JSON.stringify(selectedPlatformData));
	}

	// Handle select all eVaults
	function handleSelectAllEVaults(checked: boolean) {
		console.log('🎯 handleSelectAllEVaults called with:', checked);
		console.log('evaults.length:', evaults.length);

		if (checked) {
			// Select all eVaults
			selectedEVaults = Array.from({ length: evaults.length }, (_, i) => i);
			console.log('✅ Selected all eVaults, selectedEVaults:', selectedEVaults);
		} else {
			// Deselect all eVaults
			selectedEVaults = [];
			console.log('❌ Deselected all eVaults, selectedEVaults:', selectedEVaults);
		}

		// Store selections immediately in sessionStorage
		const selectedEVaultData = selectedEVaults.map((i) => evaults[i]);
		sessionStorage.setItem('selectedEVaults', JSON.stringify(selectedEVaultData));
		console.log('💾 Stored in sessionStorage:', selectedEVaultData);
	}

	// Handle select all platforms
	function handleSelectAllPlatforms(checked: boolean) {
		console.log('🎯 handleSelectAllPlatforms called with:', checked);
		console.log('platforms.length:', platforms.length);

		if (checked) {
			// Select all platforms
			selectedPlatforms = Array.from({ length: platforms.length }, (_, i) => i);
			console.log('✅ Selected all platforms, selectedPlatforms:', selectedPlatforms);
		} else {
			// Deselect all platforms
			selectedPlatforms = [];
			console.log('❌ Deselected all platforms, selectedPlatforms:', selectedPlatforms);
		}

		// Store selections immediately in sessionStorage
		const selectedPlatformData = selectedPlatforms.map((i) => platforms[i]);
		sessionStorage.setItem('selectedPlatforms', JSON.stringify(selectedPlatformData));
		console.log('💾 Stored in sessionStorage:', selectedPlatformData);
	}

	// Clear eVault selection
	function clearEVaultSelection() {
		selectedEVaults = [];
		sessionStorage.removeItem('selectedEVaults');
	}

	// Clear platform selection
	function clearPlatformSelection() {
		selectedPlatforms = [];
		sessionStorage.removeItem('selectedPlatforms');
	}

	// Navigate to monitoring with selected items
	function goToMonitoring() {
		const selectedEVaultData = selectedEVaults.map((i) => evaults[i]);
		const selectedPlatformData = selectedPlatforms.map((i) => platforms[i]);

		// Store selected data in sessionStorage to pass to monitoring page
		sessionStorage.setItem('selectedEVaults', JSON.stringify(selectedEVaultData));
		sessionStorage.setItem('selectedPlatforms', JSON.stringify(selectedPlatformData));

		goto('/monitoring');
	}

	const fetchEVaults = async () => {
		try {
			isLoading = true;
			error = null;
			const data = await EVaultService.getEVaults();
			evaults = data;

			// Map the data after fetching
			try {
				const mapped = data.map((evault) => {
					const mapped = {
						eName: {
							type: 'text',
							value: evault.evaultId,
							className:
								'cursor-pointer text-blue-600 hover:text-blue-800 hover:underline'
						},
						Uptime: {
							type: 'text',
							value: evault.age
						},
						IP: {
							type: 'text',
							value: evault.ip
						},
						URI: {
							type: 'link',
							value: evault.serviceUrl || 'N/A',
							link: evault.serviceUrl || '#',
							external: true
						}
					};
					return mapped;
				});

				mappedData = mapped;
			} catch (mappingError) {
				console.error('Error mapping data:', mappingError);
				error =
					'Error mapping data: ' +
					(mappingError instanceof Error ? mappingError.message : String(mappingError));
			}
		} catch (err) {
			error = 'Failed to fetch eVaults';
			console.error('Error fetching eVaults:', err);
		} finally {
			isLoading = false;
		}
	};

	const fetchPlatforms = async () => {
		try {
			platformsLoading = true;
			platformsError = null;
			const data = await registryService.getPlatforms();
			platforms = data;
		} catch (err) {
			platformsError = 'Failed to fetch platforms';
			console.error('Error fetching platforms:', err);
		} finally {
			platformsLoading = false;
		}
	};

	let currentSelectedEVaultIndex = $state(-1);

	function handleEVaultRowClick(index: number) {
		const evault = evaults[index];
		if (evault) {
			goto(`/monitoring/${evault.namespace}/${evault.name}`);
		}
	}

	onMount(() => {
		fetchEVaults();
		fetchPlatforms();
	});
</script>

<section class="flex flex-col gap-7">
	<TableCard>
		<TableCardHeader
			title="eVaults"
			placeholder="Search eVaults"
			bind:searchValue={evaultsSearchValue}
			rightTitle={selectedEVaults.length > 0
				? `${selectedEVaults.length} eVault${selectedEVaults.length === 1 ? '' : 's'} selected`
				: 'Monitoring all eVault pods across Kubernetes clusters'}
			showClearSelection={selectedEVaults.length > 0}
			onClearSelection={clearEVaultSelection}
		/>

		{#if isLoading}
			<div class="flex justify-center py-8">
				<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
			</div>
		{:else if error}
			<div class="py-8 text-center text-red-500">
				{error}
				<button
					onclick={fetchEVaults}
					class="ml-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
				>
					Retry
				</button>
			</div>
		{:else if evaults.length === 0}
			<div class="py-8 text-center text-gray-500">
				No eVault pods found. Make sure kubectl is configured and eVault pods are running.
			</div>
		{:else}
			<Table
				class="mb-7"
				tableData={mappedData}
				withSelection={true}
				{handlePreviousPage}
				{handleNextPage}
				handleSelectedRow={handleEVaultRowClick}
				onSelectionChange={handleEVaultSelectionChange}
				onSelectAllChange={handleSelectAllEVaults}
				selectedIndices={selectedEVaults}
			/>
		{/if}
	</TableCard>

	<TableCard>
		<TableCardHeader
			title="Platforms"
			placeholder="Search Platforms"
			bind:searchValue={platformsSearchQuery}
			rightTitle={selectedPlatforms.length > 0
				? `${selectedPlatforms.length} platform${selectedPlatforms.length === 1 ? '' : 's'} selected`
				: 'No platform selected. Select a platform to monitor logs'}
			showClearSelection={selectedPlatforms.length > 0}
			onClearSelection={clearPlatformSelection}
		/>
		{#if platformsLoading}
			<div class="flex justify-center py-8">
				<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
			</div>
		{:else if platformsError}
			<div class="py-8 text-center text-red-500">
				{platformsError}
				<button
					onclick={fetchPlatforms}
					class="ml-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
				>
					Retry
				</button>
			</div>
		{:else if platforms.length === 0}
			<div class="py-8 text-center text-gray-500">
				No platforms found. Make sure the registry service is running.
			</div>
		{:else}
			<Table
				class="mb-7"
				tableData={mappedPlatformsData}
				withSelection={true}
				{handlePreviousPage}
				{handleNextPage}
				onSelectionChange={handlePlatformSelectionChange}
				onSelectAllChange={handleSelectAllPlatforms}
				selectedIndices={selectedPlatforms}
			/>
		{/if}
	</TableCard>
</section>
