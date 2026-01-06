<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';
	import { apiClient } from '$lib/utils/axios';
	import { toast } from '$lib/stores/toast';

	let isLoading = $state(true);
	let used = $state(0);
	let limit = $state(1073741824); // 1GB in bytes
	let percentage = $state(0);

	onMount(async () => {
		isAuthenticated.subscribe((auth) => {
			if (!auth) {
				goto('/auth');
			}
		});

		await fetchStorageUsage();
	});

	async function fetchStorageUsage() {
		try {
			isLoading = true;
			const response = await apiClient.get('/api/storage');
			used = response.data.used;
			limit = response.data.limit;
			percentage = (used / limit) * 100;
		} catch (error) {
			console.error('Failed to fetch storage usage:', error);
			toast.error('Failed to load storage information');
		} finally {
			isLoading = false;
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function getColorClass(): string {
		if (percentage >= 90) return 'bg-red-500';
		if (percentage >= 75) return 'bg-yellow-500';
		return 'bg-green-500';
	}

	function getTextColorClass(): string {
		if (percentage >= 90) return 'text-red-600';
		if (percentage >= 75) return 'text-yellow-600';
		return 'text-green-600';
	}
</script>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<div class="mb-6">
		<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Storage</h1>
		<p class="text-sm sm:text-base text-gray-600">Manage your file storage usage</p>
	</div>

	{#if isLoading}
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
			<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
			<p class="text-gray-600">Loading storage information...</p>
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
			<div class="mb-6">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium text-gray-700">Storage Used</span>
					<span class="text-sm font-semibold {getTextColorClass()}">
						{formatBytes(used)} / {formatBytes(limit)}
					</span>
				</div>
				<div class="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
					<div 
						class="h-4 rounded-full transition-all duration-300 {getColorClass()}"
						style="width: {Math.min(percentage, 100).toFixed(2)}%"
					></div>
				</div>
				<p class="text-xs text-gray-500 mt-2">
					{percentage.toFixed(1)}% of your total storage
				</p>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
				<div class="bg-gray-50 rounded-lg p-4">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
							<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
							</svg>
						</div>
						<div>
							<p class="text-xs text-gray-500 uppercase">Used</p>
							<p class="text-lg font-semibold text-gray-900">{formatBytes(used)}</p>
						</div>
					</div>
				</div>

				<div class="bg-gray-50 rounded-lg p-4">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
							<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<div>
							<p class="text-xs text-gray-500 uppercase">Available</p>
							<p class="text-lg font-semibold text-gray-900">{formatBytes(limit - used)}</p>
						</div>
					</div>
				</div>
			</div>

			{#if percentage >= 90}
				<div class="bg-red-50 border border-red-200 rounded-lg p-4">
					<div class="flex gap-3">
						<svg class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						<div>
							<h4 class="text-sm font-semibold text-red-900 mb-1">Storage Almost Full</h4>
							<p class="text-sm text-red-700">
								You're running low on storage space. Consider deleting some files to free up space.
							</p>
						</div>
					</div>
				</div>
			{:else if percentage >= 75}
				<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
					<div class="flex gap-3">
						<svg class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<div>
							<h4 class="text-sm font-semibold text-yellow-900 mb-1">Storage Getting Full</h4>
							<p class="text-sm text-yellow-700">
								You've used {percentage.toFixed(1)}% of your storage. You may want to clean up some files soon.
							</p>
						</div>
					</div>
				</div>
			{/if}

			<div class="mt-6 flex flex-col sm:flex-row gap-3">
				<button
					onclick={() => goto('/files')}
					class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
					</svg>
					Go to Files
				</button>
				<button
					onclick={fetchStorageUsage}
					class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Refresh
				</button>
			</div>
		</div>

		<div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
			<div class="flex gap-3">
				<svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<div class="flex-1">
					<h4 class="text-sm font-semibold text-blue-900 mb-1">Storage Limits</h4>
					<ul class="text-sm text-blue-700 space-y-1">
						<li>• Maximum file size: 5 MB per file</li>
						<li>• Total storage quota: 1 GB</li>
						<li>• Deleted files are permanently removed and cannot be recovered</li>
					</ul>
				</div>
			</div>
		</div>
	{/if}
</div>
