<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';
	import { files, fetchFiles, uploadFile, deleteFile } from '$lib/stores/files';
	import { folders, fetchFolders, fetchFolderTree, folderTree, createFolder, deleteFolder } from '$lib/stores/folders';
	import { apiClient } from '$lib/utils/axios';
	import { PUBLIC_FILE_MANAGER_BASE_URL } from '$env/static/public';
	import { toast } from '$lib/stores/toast';

	const API_BASE_URL = PUBLIC_FILE_MANAGER_BASE_URL || 'http://localhost:3005';

	let currentFolderId = $state<string | null>(null);
	let isLoading = $state(false);
	let showUploadModal = $state(false);
	let showFolderModal = $state(false);
	let selectedFile = $state<globalThis.File | null>(null);
	let folderName = $state('');
	let dragOver = $state(false);
	let previewFile = $state<any>(null);
	let previewUrl = $state<string | null>(null);
	let breadcrumbs = $state<Array<{ id: string | null; name: string }>>([{ id: null, name: 'My Files' }]);

	onMount(async () => {
		isAuthenticated.subscribe((auth) => {
			if (!auth) {
				goto('/auth');
			}
		});

		await fetchFolderTree();
		await loadFiles();
		await updateBreadcrumbs();
	});

	async function loadFiles() {
		isLoading = true;
		try {
			// Always pass folderId explicitly - null for root, or the actual folderId
			// This ensures root view only shows items with folderId/parentFolderId = null
			const folderId = currentFolderId === null ? null : currentFolderId;
			await Promise.all([
				fetchFiles(folderId),
				fetchFolders(folderId)
			]);
		} catch (error) {
			console.error('Failed to load files:', error);
			toast.error('Failed to load files');
		} finally {
			isLoading = false;
		}
	}

	async function handleFileUpload(file: globalThis.File) {
		try {
			isLoading = true;
			await uploadFile(file, currentFolderId);
			toast.success('File uploaded successfully');
			showUploadModal = false;
			selectedFile = null;
		} catch (error) {
			console.error('Upload failed:', error);
			toast.error('Failed to upload file');
		} finally {
			isLoading = false;
		}
	}

	async function handleCreateFolder() {
		if (!folderName.trim()) {
			toast.error('Folder name is required');
			return;
		}

		try {
			isLoading = true;
			await createFolder(folderName.trim(), currentFolderId);
			toast.success('Folder created successfully');
			showFolderModal = false;
			folderName = '';
			await loadFiles();
		} catch (error) {
			console.error('Failed to create folder:', error);
			toast.error('Failed to create folder');
		} finally {
			isLoading = false;
		}
	}

	async function handleDeleteFile(fileId: string) {
		if (!confirm('Are you sure you want to delete this file?')) {
			return;
		}

		try {
			await deleteFile(fileId);
			toast.success('File deleted successfully');
		} catch (error) {
			console.error('Failed to delete file:', error);
			toast.error('Failed to delete file');
		}
	}

	async function handleDeleteFolder(folderId: string) {
		if (!confirm('Are you sure you want to delete this folder? All contents will be deleted.')) {
			return;
		}

		try {
			await deleteFolder(folderId);
			toast.success('Folder deleted successfully');
			await loadFiles();
		} catch (error) {
			console.error('Failed to delete folder:', error);
			toast.error('Failed to delete folder');
		}
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			selectedFile = target.files[0];
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;

		if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
			const file = event.dataTransfer.files[0];
			await handleFileUpload(file);
		}
	}

	async function navigateToFolder(folderId: string | null) {
		currentFolderId = folderId;
		await loadFiles();
		await updateBreadcrumbs();
	}

	async function updateBreadcrumbs() {
		if (!currentFolderId) {
			breadcrumbs = [{ id: null, name: 'My Files' }];
			return;
		}

		// Build breadcrumb path by fetching folder details
		const buildPath = async (folderId: string | null, path: Array<{ id: string | null; name: string }> = []): Promise<Array<{ id: string | null; name: string }>> => {
			if (!folderId) {
				return [{ id: null, name: 'My Files' }, ...path];
			}

			try {
				// Fetch folder details
				const response = await apiClient.get(`/api/folders/${folderId}`);
				const folder = response.data;

				const newPath = [{ id: folder.id, name: folder.name }, ...path];
				// Use parentFolderId (not parentId) as that's what the API returns
				if (folder.parentFolderId) {
					return buildPath(folder.parentFolderId, newPath);
				}
				return [{ id: null, name: 'My Files' }, ...newPath];
			} catch (error) {
				console.error('Failed to fetch folder for breadcrumb:', error);
				return [{ id: null, name: 'My Files' }, ...path];
			}
		};

		breadcrumbs = await buildPath(currentFolderId);
	}

	async function handlePreviewFile(file: any, event: Event) {
		event.stopPropagation();
		if (file.canPreview) {
			previewFile = file;
			// Add auth token as query parameter for img/iframe tags
			const token = localStorage.getItem('file_manager_auth_token');
			previewUrl = `${API_BASE_URL}/api/files/${file.id}/preview?token=${token || ''}`;
		} else {
			// If not previewable, go to detail page
			goto(`/files/${file.id}`);
		}
	}

	function closePreview() {
		previewFile = null;
		previewUrl = null;
	}

	function getFileIcon(mimeType: string): string {
		if (mimeType.startsWith('image/')) return '🖼️';
		if (mimeType === 'application/pdf') return '📄';
		if (mimeType.includes('text')) return '📝';
		if (mimeType.includes('video')) return '🎥';
		if (mimeType.includes('audio')) return '🎵';
		return '📎';
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', { 
			year: 'numeric', 
			month: 'short', 
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Combine folders and files, with folders first
	const allItems = $derived([
		...$folders.map(f => ({ ...f, type: 'folder' as const })),
		...$files.map(f => ({ ...f, type: 'file' as const }))
	].sort((a, b) => {
		// Folders first, then by date
		if (a.type !== b.type) {
			return a.type === 'folder' ? -1 : 1;
		}
		return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
	}));
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Breadcrumbs -->
	<div class="mb-4">
		<nav class="flex items-center gap-2 text-sm">
			{#each breadcrumbs as crumb, index}
				{#if index > 0}
					<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				{/if}
				<button
					onclick={() => navigateToFolder(crumb.id)}
					class="text-gray-600 hover:text-gray-900 {index === breadcrumbs.length - 1 ? 'font-semibold text-gray-900' : ''}"
				>
					{crumb.name}
				</button>
			{/each}
		</nav>
	</div>

	<div class="mb-6 flex items-center justify-between">
		<div class="flex items-center gap-4">
			<h2 class="text-2xl font-bold text-gray-900">
				{breadcrumbs[breadcrumbs.length - 1].name}
			</h2>
		</div>
		<div class="flex items-center gap-2">
			<button
				onclick={() => showFolderModal = true}
				class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				New Folder
			</button>
			<button
				onclick={() => showUploadModal = true}
				class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Upload
			</button>
		</div>
	</div>

	<div
		class="bg-white rounded-lg border border-gray-200 shadow-sm {dragOver ? 'border-blue-500 bg-blue-50' : ''}"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
	>
		{#if isLoading}
			<div class="text-center py-12">
				<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
				<p class="text-gray-600">Loading...</p>
			</div>
		{:else if allItems.length === 0}
			<div class="text-center py-12">
				<p class="text-gray-500 mb-4">No files or folders yet</p>
				<p class="text-sm text-gray-400">Drag and drop files here or click Upload</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50 border-b border-gray-200">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
								Name
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Size
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Modified
							</th>
							<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each allItems as item}
							<tr
								class="hover:bg-gray-50 transition-colors cursor-pointer {item.type === 'folder' ? '' : ''}"
								onclick={(e) => {
									if (item.type === 'folder') {
										navigateToFolder(item.id);
									} else {
										handlePreviewFile(item, e);
									}
								}}
							>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="flex items-center gap-3">
										<span class="text-2xl flex-shrink-0">
											{item.type === 'folder' ? '📁' : getFileIcon(item.type === 'file' ? item.mimeType : '')}
										</span>
										<div class="flex-1 min-w-0">
											<div class="text-sm font-medium text-gray-900 truncate">
												{item.displayName || item.name}
											</div>
											{#if item.type === 'file' && item.description}
												<div class="text-xs text-gray-500 truncate">{item.description}</div>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{item.type === 'folder' ? '—' : formatFileSize(item.type === 'file' ? item.size : 0)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{formatDate(item.updatedAt || item.createdAt)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
									<button
										onclick={(e) => { 
											e.stopPropagation(); 
											if (item.type === 'folder') {
												handleDeleteFolder(item.id);
											} else {
												handleDeleteFile(item.id);
											}
										}}
										class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
										title="Delete"
									>
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- Upload Modal -->
{#if showUploadModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
			<h3 class="text-xl font-bold mb-4">Upload File</h3>
			<input
				type="file"
				onchange={handleFileSelect}
				class="mb-4 w-full"
			/>
			{#if selectedFile}
				<p class="text-sm text-gray-600 mb-4">Selected: {selectedFile.name}</p>
			{/if}
			<div class="flex gap-2 justify-end">
				<button
					onclick={() => { showUploadModal = false; selectedFile = null; }}
					class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
				>
					Cancel
				</button>
				<button
					onclick={() => selectedFile && handleFileUpload(selectedFile)}
					disabled={!selectedFile || isLoading}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
				>
					Upload
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Preview Modal -->
{#if previewFile && previewUrl}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={closePreview}>
		<div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-xl font-bold">{previewFile.displayName || previewFile.name}</h3>
				<button
					onclick={closePreview}
					class="text-gray-500 hover:text-gray-700"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			{#if previewFile.mimeType.startsWith('image/')}
				<img src={previewUrl} alt={previewFile.name} class="max-w-full h-auto rounded-lg" />
			{:else if previewFile.mimeType === 'application/pdf'}
				<iframe src={previewUrl} class="w-full h-[600px] rounded-lg border border-gray-200"></iframe>
			{/if}
			<div class="mt-4 flex gap-2 justify-end">
				<a
					href={`${API_BASE_URL}/api/files/${previewFile.id}/download`}
					download={previewFile.name}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
				>
					Download
				</a>
				<button
					onclick={() => goto(`/files/${previewFile.id}`)}
					class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
				>
					View Details
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Folder Modal -->
{#if showFolderModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
			<h3 class="text-xl font-bold mb-4">Create Folder</h3>
			<input
				type="text"
				bind:value={folderName}
				placeholder="Folder name"
				class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
				onkeydown={(e) => e.key === 'Enter' && handleCreateFolder()}
			/>
			<div class="flex gap-2 justify-end">
				<button
					onclick={() => { showFolderModal = false; folderName = ''; }}
					class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
				>
					Cancel
				</button>
				<button
					onclick={handleCreateFolder}
					disabled={isLoading}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
				>
					Create
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Preview Modal -->
{#if previewFile && previewUrl}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={closePreview}>
		<div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-xl font-bold">{previewFile.displayName || previewFile.name}</h3>
				<button
					onclick={closePreview}
					class="text-gray-500 hover:text-gray-700"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			{#if previewFile.mimeType.startsWith('image/')}
				<img src={previewUrl} alt={previewFile.name} class="max-w-full h-auto rounded-lg" />
			{:else if previewFile.mimeType === 'application/pdf'}
				<iframe src={previewUrl} class="w-full h-[600px] rounded-lg border border-gray-200"></iframe>
			{/if}
			<div class="mt-4 flex gap-2 justify-end">
				<a
					href={`${API_BASE_URL}/api/files/${previewFile.id}/download`}
					download={previewFile.name}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
				>
					Download
				</a>
				<button
					onclick={() => goto(`/files/${previewFile.id}`)}
					class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
				>
					View Details
				</button>
			</div>
		</div>
	</div>
{/if}

