<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';
	import { files, fetchFiles, uploadFile, deleteFile, moveFile } from '$lib/stores/files';
	import { folders, fetchFolders, fetchFolderTree, folderTree, createFolder, deleteFolder, moveFolder } from '$lib/stores/folders';
	import { apiClient } from '$lib/utils/axios';
	import { PUBLIC_FILE_MANAGER_BASE_URL } from '$env/static/public';
	import { toast } from '$lib/stores/toast';

	const API_BASE_URL = PUBLIC_FILE_MANAGER_BASE_URL || 'http://localhost:3005';

	let currentFolderId = $state<string | null>(null);
	let isLoading = $state(false);
	let showUploadModal = $state(false);
	let showFolderModal = $state(false);
	let showMoveModal = $state(false);
	let showDeleteModal = $state(false);
	let selectedFile = $state<globalThis.File | null>(null);
	let itemToMove = $state<any>(null);
	let itemToDelete = $state<{ type: 'file' | 'folder'; id: string; name: string } | null>(null);
	let moveModalFolderId = $state<string | null>(null);
	let moveModalBreadcrumbs = $state<Array<{ id: string | null; name: string }>>([{ id: null, name: 'My Files' }]);
	let moveModalFolders = $state<any[]>([]);
	let folderName = $state('');
	let dragOver = $state(false);
	let uploadModalDragOver = $state(false);
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

	function openDeleteModal(item: any, type: 'file' | 'folder') {
		itemToDelete = {
			type,
			id: item.id,
			name: item.displayName || item.name
		};
		showDeleteModal = true;
	}

	async function handleDelete() {
		if (!itemToDelete) return;

		try {
			if (itemToDelete.type === 'file') {
				await deleteFile(itemToDelete.id);
				toast.success('File deleted successfully');
			} else {
				await deleteFolder(itemToDelete.id);
				toast.success('Folder deleted successfully');
				await loadFiles();
			}
			showDeleteModal = false;
			itemToDelete = null;
		} catch (error) {
			console.error('Failed to delete:', error);
			toast.error(`Failed to delete ${itemToDelete.type}`);
		}
	}

	async function handleMove(item: any, type: 'file' | 'folder', folderId: string | null) {
		try {
			isLoading = true;
			if (type === 'file') {
				await moveFile(item.id, folderId);
				toast.success('File moved successfully');
			} else {
				await moveFolder(item.id, folderId);
				toast.success('Folder moved successfully');
			}
			showMoveModal = false;
			itemToMove = null;
			moveModalFolderId = null;
			moveModalBreadcrumbs = [{ id: null, name: 'My Files' }];
			await loadFiles();
		} catch (error) {
			console.error('Failed to move:', error);
			toast.error(`Failed to move ${type}`);
		} finally {
			isLoading = false;
		}
	}

	async function openMoveModal(item: any, type: 'file' | 'folder') {
		itemToMove = { ...item, _type: type };
		moveModalFolderId = null;
		moveModalBreadcrumbs = [{ id: null, name: 'My Files' }];
		showMoveModal = true;
		await loadMoveModalFolders(null);
	}

	async function loadMoveModalFolders(folderId: string | null) {
		try {
			const params: any = {};
			if (folderId === null || folderId === undefined) {
				params.parentFolderId = 'null';
			} else {
				params.parentFolderId = folderId;
			}
			const response = await apiClient.get('/api/folders', { params });
			moveModalFolders = response.data || [];
		} catch (error) {
			console.error('Failed to load folders for move modal:', error);
			moveModalFolders = [];
		}
	}

	async function navigateMoveModal(folderId: string | null) {
		moveModalFolderId = folderId;
		await loadMoveModalFolders(folderId);
		await updateMoveModalBreadcrumbs(folderId);
	}

	async function updateMoveModalBreadcrumbs(folderId: string | null) {
		if (!folderId) {
			moveModalBreadcrumbs = [{ id: null, name: 'My Files' }];
			return;
		}

		const buildPath = async (fId: string | null, path: Array<{ id: string | null; name: string }> = []): Promise<Array<{ id: string | null; name: string }>> => {
			if (!fId) {
				return [{ id: null, name: 'My Files' }, ...path];
			}

			try {
				const response = await apiClient.get(`/api/folders/${fId}`);
				const folder = response.data;
				const newPath = [{ id: folder.id, name: folder.name }, ...path];
				if (folder.parentFolderId) {
					return buildPath(folder.parentFolderId, newPath);
				}
				return [{ id: null, name: 'My Files' }, ...newPath];
			} catch (error) {
				console.error('Failed to fetch folder for breadcrumb:', error);
				return [{ id: null, name: 'My Files' }, ...path];
			}
		};

		moveModalBreadcrumbs = await buildPath(folderId);
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			selectedFile = target.files[0];
		}
	}

	function handleUploadModalDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		uploadModalDragOver = true;
	}

	function handleUploadModalDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		uploadModalDragOver = false;
	}

	async function handleUploadModalDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		uploadModalDragOver = false;

		if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
			selectedFile = event.dataTransfer.files[0];
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
									<div class="flex items-center justify-end gap-2">
										<button
											onclick={(e) => { 
												e.stopPropagation(); 
												openMoveModal(item, item.type);
											}}
											class="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"
											title="Move"
										>
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
											</svg>
										</button>
										<button
											onclick={(e) => { 
												e.stopPropagation(); 
												openDeleteModal(item, item.type);
											}}
											class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
											title="Delete"
										>
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									</div>
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
		<div class="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
			<h3 class="text-xl font-bold mb-4">Upload File</h3>
			
			<!-- Drag and Drop Area -->
			<div
				class="border-2 border-dashed rounded-lg p-8 text-center transition-colors {uploadModalDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}"
				ondragover={handleUploadModalDragOver}
				ondragleave={handleUploadModalDragLeave}
				ondrop={handleUploadModalDrop}
			>
				{#if selectedFile}
					<div class="mb-4">
						<svg class="w-12 h-12 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<p class="text-sm font-medium text-gray-900">{selectedFile.name}</p>
						<p class="text-xs text-gray-500 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
					</div>
					<label class="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors">
						<span>Choose Different File</span>
						<input
							type="file"
							onchange={handleFileSelect}
							class="hidden"
						/>
					</label>
				{:else}
					<svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
					</svg>
					<p class="text-gray-600 mb-2 font-medium">Drag and drop your file here</p>
					<p class="text-sm text-gray-500 mb-4">or</p>
					<label class="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
						<span>Browse Files</span>
						<input
							type="file"
							onchange={handleFileSelect}
							class="hidden"
						/>
					</label>
				{/if}
			</div>

			<div class="flex gap-2 justify-end mt-6">
				<button
					onclick={() => { showUploadModal = false; selectedFile = null; uploadModalDragOver = false; }}
					class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
				>
					Cancel
				</button>
				<button
					onclick={() => selectedFile && handleFileUpload(selectedFile)}
					disabled={!selectedFile || isLoading}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isLoading ? 'Uploading...' : 'Upload'}
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

<!-- Move Modal -->
{#if showMoveModal && itemToMove}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
			<h3 class="text-xl font-bold mb-4">Move {itemToMove._type === 'file' ? 'File' : 'Folder'}</h3>
			<p class="text-sm text-gray-600 mb-4">Moving: <strong>{itemToMove.displayName || itemToMove.name}</strong></p>
			
			<!-- Breadcrumbs -->
			<div class="mb-4 pb-4 border-b border-gray-200">
				<nav class="flex items-center gap-2 text-sm">
					{#each moveModalBreadcrumbs as crumb, index}
						{#if index > 0}
							<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
						{/if}
						<button
							onclick={() => navigateMoveModal(crumb.id)}
							class="text-gray-600 hover:text-gray-900 {index === moveModalBreadcrumbs.length - 1 ? 'font-semibold text-gray-900' : ''}"
						>
							{crumb.name}
						</button>
					{/each}
				</nav>
			</div>

			<!-- Folder List -->
			<div class="flex-1 overflow-y-auto mb-4 border border-gray-200 rounded-lg">
				{#if moveModalFolders.length === 0}
					<div class="p-8 text-center text-gray-500">
						<p>No folders in this location</p>
					</div>
				{:else}
					<div class="divide-y divide-gray-200">
						{#each moveModalFolders.filter(f => itemToMove?._type !== 'folder' || f.id !== itemToMove?.id) as folder}
							<button
								onclick={() => navigateMoveModal(folder.id)}
								class="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
							>
								<span class="text-2xl">📁</span>
								<span class="font-medium text-gray-900">{folder.name}</span>
								<svg class="w-5 h-5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
								</svg>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Current Location Info -->
			<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
				<p class="text-sm text-gray-700">
					<span class="font-medium">Current location:</span> {moveModalBreadcrumbs[moveModalBreadcrumbs.length - 1].name}
				</p>
			</div>

			<!-- Actions -->
			<div class="flex gap-2 justify-end">
				<button
					onclick={() => { 
						showMoveModal = false; 
						itemToMove = null; 
						moveModalFolderId = null;
						moveModalBreadcrumbs = [{ id: null, name: 'My Files' }];
					}}
					class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
				>
					Cancel
				</button>
				<button
					onclick={() => handleMove(itemToMove, itemToMove._type, moveModalFolderId)}
					disabled={isLoading}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
				>
					Move Here
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && itemToDelete}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
			<h3 class="text-xl font-bold mb-4">Delete {itemToDelete.type === 'file' ? 'File' : 'Folder'}</h3>
			<p class="text-gray-700 mb-2">
				Are you sure you want to delete <strong>{itemToDelete.name}</strong>?
			</p>
			{#if itemToDelete.type === 'folder'}
				<p class="text-sm text-red-600 mb-4">
					⚠️ This will delete the folder and all its contents permanently.
				</p>
			{:else}
				<p class="text-sm text-red-600 mb-4">
					⚠️ This action cannot be undone.
				</p>
			{/if}
			<div class="flex gap-2 justify-end">
				<button
					onclick={() => { 
						showDeleteModal = false; 
						itemToDelete = null; 
					}}
					class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
				>
					Cancel
				</button>
				<button
					onclick={handleDelete}
					class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
				>
					Delete
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


