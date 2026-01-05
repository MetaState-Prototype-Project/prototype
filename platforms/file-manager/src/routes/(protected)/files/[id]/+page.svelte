<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';
	import { apiClient } from '$lib/utils/axios';
	import { PUBLIC_FILE_MANAGER_BASE_URL } from '$env/static/public';
	import { toast } from '$lib/stores/toast';
	import { fetchFileAccess, grantFileAccess, revokeFileAccess, fileAccess } from '$lib/stores/access';
	import { tags, fetchTags, addTagToFile, removeTagFromFile, createTag } from '$lib/stores/tags';
	import { currentUser } from '$lib/stores/auth';
	import { fetchFileSignatures } from '$lib/stores/signatures';

	let file = $state<any>(null);
	let isLoading = $state(false);
	let previewUrl = $state<string | null>(null);
	let showAccessModal = $state(false);
	let showTagModal = $state(false);
	let searchQuery = $state('');
	let searchResults = $state<any[]>([]);
	let selectedUsers = $state<any[]>([]);
	let selectedTag = $state<string | null>(null);
	let tagInput = $state('');
	let filteredTags = $state<any[]>([]);
	let breadcrumbs = $state<Array<{ id: string | null; name: string }>>([{ id: null, name: 'My Files' }]);

	onMount(async () => {
		isAuthenticated.subscribe((auth) => {
			if (!auth) {
				goto('/auth');
			}
		});

		const fileId = $page.params.id;
		if (!fileId) {
			toast.error('File ID is required');
			goto('/files');
			return;
		}
		await loadFile(fileId);
		
		// Only fetch access and tags if user is the owner
		if (file && file.ownerId === $currentUser?.id) {
			await fetchFileAccess(fileId);
			await fetchTags();
		}
		
		await fetchFileSignatures(fileId);
	});

	async function loadFile(fileId: string) {
		try {
			isLoading = true;
			const response = await apiClient.get(`/api/files/${fileId}`);
			file = response.data;

			// Generate preview URL if file can be previewed
			if (file.canPreview) {
				const API_BASE_URL = PUBLIC_FILE_MANAGER_BASE_URL || 'http://localhost:3005';
				const token = localStorage.getItem('file_manager_auth_token');
				previewUrl = `${API_BASE_URL}/api/files/${fileId}/preview?token=${token || ''}`;
			}

			// Build breadcrumbs based on file's folder
			await updateBreadcrumbs();
		} catch (err) {
			console.error('Failed to load file:', err);
			toast.error('Failed to load file');
			goto('/files');
		} finally {
			isLoading = false;
		}
	}

	async function updateBreadcrumbs() {
		if (!file) {
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

		// Start with file's folder, then add file name at the end
		const folderPath = await buildPath(file.folderId);
		breadcrumbs = [...folderPath, { id: file.id, name: file.displayName || file.name }];
	}

	function navigateToFolder(folderId: string | null) {
		// Navigate back to files list - the files page will handle folder navigation
		if (folderId === null) {
			goto('/files');
		} else {
			// For now, just go to files list - could enhance to pass folderId via query param
			goto('/files');
		}
	}

	async function downloadFile() {
		try {
			const response = await apiClient.get(`/api/files/${file.id}/download`, {
				responseType: 'blob'
			});
			const url = window.URL.createObjectURL(new Blob([response.data]));
			const link = document.createElement('a');
			link.href = url;
			link.setAttribute('download', file.name);
			document.body.appendChild(link);
			link.click();
			link.remove();
			toast.success('File downloaded');
		} catch (error) {
			console.error('Download failed:', error);
			toast.error('Failed to download file');
		}
	}

	async function searchUsers() {
		if (searchQuery.length < 2) {
			searchResults = [];
			return;
		}

		try {
			// Search both users and groups
			const [usersResponse, groupsResponse] = await Promise.all([
				apiClient.get('/api/users/search', {
					params: { query: searchQuery }
				}),
				apiClient.get('/api/groups/search', {
					params: { query: searchQuery }
				})
			]);
			
			// Mark users with type 'user' and groups with type 'group'
			const users = (usersResponse.data || []).map((u: any) => ({ ...u, type: 'user' }));
			const groups = (groupsResponse.data || []).map((g: any) => ({ 
				...g, 
				type: 'group',
				memberCount: (g.members?.length || 0) + (g.participants?.length || 0) + (g.admins?.length || 0)
			}));
			
			searchResults = [...users, ...groups];
		} catch (error) {
			console.error('Search failed:', error);
			searchResults = [];
		}
	}

	async function handleGrantAccess() {
		if (selectedUsers.length === 0) {
			toast.error('Please select at least one user or group');
			return;
		}

		try {
			let shareCount = 0;
			
			for (const item of selectedUsers) {
				if (item.type === 'group') {
					// Share with all members of the group
					const groupMembers = [
						...(item.members || []),
						...(item.participants || []),
						...(item.admins || [])
					];
					
					// Remove duplicates by id
					const uniqueMembers = Array.from(new Map(groupMembers.map(m => [m.id, m])).values());
					
					for (const member of uniqueMembers) {
						await grantFileAccess(file.id, member.id);
						shareCount++;
					}
				} else {
					// Share with individual user
					await grantFileAccess(file.id, item.id);
					shareCount++;
				}
			}
			
			toast.success(`File shared with ${shareCount} ${shareCount === 1 ? 'person' : 'people'}`);
			showAccessModal = false;
			selectedUsers = [];
			searchQuery = '';
			searchResults = [];
			await fetchFileAccess(file.id);
		} catch (error) {
			console.error('Failed to grant access:', error);
			toast.error('Failed to grant access');
		}
	}

	function handleTagSearch() {
		const query = tagInput.toLowerCase().trim();
		if (!query) {
			filteredTags = [];
			return;
		}
		filteredTags = $tags.filter(tag => 
			tag.name.toLowerCase().includes(query)
		);
	}

	async function handleCreateOrSelectTag() {
		const tagName = tagInput.trim();
		if (!tagName) {
			return;
		}

		try {
			// Check if tag already exists
			const existingTag = $tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
			
			if (existingTag) {
				// Use existing tag
				selectedTag = existingTag.id;
			} else {
				// Create new tag
				const newTag = await createTag(tagName, null);
				selectedTag = newTag.id;
			}

			// Add tag to file
			await addTagToFile(file.id, selectedTag);
			toast.success('Tag added successfully');
			showTagModal = false;
			selectedTag = null;
			tagInput = '';
			filteredTags = [];
			await loadFile(file.id);
		} catch (error) {
			console.error('Failed to add tag:', error);
			toast.error('Failed to add tag');
		}
	}

	async function handleAddTag() {
		if (!selectedTag) {
			toast.error('Please select a tag');
			return;
		}

		try {
			await addTagToFile(file.id, selectedTag);
			toast.success('Tag added successfully');
			showTagModal = false;
			selectedTag = null;
			tagInput = '';
			filteredTags = [];
			await loadFile(file.id);
		} catch (error) {
			console.error('Failed to add tag:', error);
			toast.error('Failed to add tag');
		}
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
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
	<!-- Breadcrumbs -->
	<div class="mb-4">
		<nav class="flex items-center gap-2 text-sm">
			{#each breadcrumbs as crumb, index}
				{#if index > 0}
					<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				{/if}
				{#if index === breadcrumbs.length - 1}
					<span class="font-semibold text-gray-900">{crumb.name}</span>
				{:else}
					<button
						onclick={() => navigateToFolder(crumb.id)}
						class="text-gray-600 hover:text-gray-900"
					>
						{crumb.name}
					</button>
				{/if}
			{/each}
		</nav>
	</div>

	{#if isLoading}
		<div class="text-center py-12">
			<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
			<p class="text-gray-600">Loading...</p>
		</div>
	{:else if file}
		<!-- Mobile: Stack vertically, Desktop: 70/30 split -->
		<div class="flex flex-col lg:flex-row gap-4 lg:gap-6">
			<!-- Left side: Preview (70% on desktop, full width on mobile) -->
			<div class="w-full lg:w-[70%] bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
				<div class="mb-4">
					<h1 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{file.displayName || file.name}</h1>
					<p class="text-xs sm:text-sm text-gray-500">Size: {formatFileSize(file.size)} • Type: {file.mimeType}</p>
				</div>

				{#if previewUrl}
					<div class="mb-4">
						{#if file.mimeType.startsWith('image/')}
							<img src={previewUrl} alt={file.name} class="w-full h-auto rounded-lg border border-gray-200 max-h-[70vh] object-contain" />
						{:else if file.mimeType === 'application/pdf'}
							<iframe src={previewUrl} class="w-full h-[500px] sm:h-[600px] rounded-lg border border-gray-200"></iframe>
						{:else}
							<div class="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg border border-gray-200">
								<p class="text-gray-500">Preview not available for this file type</p>
							</div>
						{/if}
					</div>
				{:else}
					<div class="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg border border-gray-200">
						<p class="text-gray-500">Preview not available for this file type</p>
					</div>
				{/if}

				<div class="flex flex-wrap gap-2">
					<button
						onclick={downloadFile}
						class="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
						</svg>
						Download
					</button>
				</div>
			</div>

			<!-- Right side: Metadata and Share Settings (30% on desktop, full width on mobile) -->
			<div class="w-full lg:w-[30%] space-y-4">
				<!-- Metadata Card -->
				<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
					<h2 class="text-lg font-semibold text-gray-900 mb-4">Details</h2>
					<dl class="space-y-3 text-sm">
						<div>
							<dt class="text-gray-500 font-medium">Name</dt>
							<dd class="text-gray-900 mt-1">{file.displayName || file.name}</dd>
						</div>
						<div>
							<dt class="text-gray-500 font-medium">Size</dt>
							<dd class="text-gray-900 mt-1">{formatFileSize(file.size)}</dd>
						</div>
						<div>
							<dt class="text-gray-500 font-medium">Type</dt>
							<dd class="text-gray-900 mt-1">{file.mimeType}</dd>
						</div>
						<div>
							<dt class="text-gray-500 font-medium">Created</dt>
							<dd class="text-gray-900 mt-1">{formatDate(file.createdAt)}</dd>
						</div>
						<div>
							<dt class="text-gray-500 font-medium">Modified</dt>
							<dd class="text-gray-900 mt-1">{formatDate(file.updatedAt || file.createdAt)}</dd>
						</div>
						{#if file.description}
							<div>
								<dt class="text-gray-500 font-medium">Description</dt>
								<dd class="text-gray-900 mt-1">{file.description}</dd>
							</div>
						{/if}
					</dl>
				</div>

				<!-- Tags Card (only show to owner) -->
				{#if file.ownerId === $currentUser?.id}
					<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
						<div class="flex items-center justify-between mb-4">
							<h2 class="text-lg font-semibold text-gray-900">Tags</h2>
							<button
								onclick={() => showTagModal = true}
								class="text-blue-600 hover:text-blue-700 text-sm font-medium"
							>
								+ Add
							</button>
						</div>
						{#if file.tags && file.tags.length > 0}
							<div class="flex flex-wrap gap-2">
								{#each file.tags as tag}
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
										{tag.name}
									</span>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-gray-500">No tags yet</p>
						{/if}
					</div>
				{/if}

				<!-- Signatures Card -->
				{#if file.signatures && file.signatures.length > 0}
					<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
						<h2 class="text-lg font-semibold text-gray-900 mb-4">
							Signatures <span class="text-gray-500 font-normal">({file.signatures.length})</span>
						</h2>
						<div class="space-y-3">
							{#each file.signatures as sig}
								<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
									<div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
										{#if sig.user?.avatarUrl}
											<img src={sig.user.avatarUrl} alt={sig.user.name || sig.user.ename} class="w-10 h-10 rounded-full" />
										{:else}
											<span class="text-blue-600 font-semibold text-sm">
												{(sig.user?.name || sig.user?.ename || '?')[0].toUpperCase()}
											</span>
										{/if}
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-gray-900 truncate">
											{sig.user?.name || sig.user?.ename || 'Unknown User'}
										</p>
										<p class="text-xs text-gray-500">
											Signed on {formatDate(sig.createdAt)}
										</p>
									</div>
									<span class="text-green-600 text-xs font-semibold">✓</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Share Settings Card (only show to owner) -->
				{#if file.ownerId === $currentUser?.id}
					<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
						<div class="flex items-center justify-between mb-4">
							<h2 class="text-lg font-semibold text-gray-900">Shared with</h2>
							<button
								onclick={() => showAccessModal = true}
								class="text-blue-600 hover:text-blue-700 text-sm font-medium"
							>
								+ Share
							</button>
						</div>
						{#if $fileAccess && $fileAccess.length > 0}
							<div class="space-y-2">
								{#each $fileAccess as access}
									<div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
										<div class="flex items-center gap-2">
											{#if access.user?.avatarUrl}
												<img src={access.user.avatarUrl} alt={access.user.name} class="w-6 h-6 rounded-full" />
											{:else}
												<div class="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
													{(access.user?.name || access.user?.ename || 'U')[0].toUpperCase()}
												</div>
											{/if}
											<div>
												<p class="text-sm font-medium text-gray-900">{access.user?.name || access.user?.ename || 'Unknown'}</p>
												<p class="text-xs text-gray-500">{access.permission}</p>
											</div>
										</div>
										<button
											onclick={async () => {
												try {
													await revokeFileAccess(file.id, access.userId);
													await fetchFileAccess(file.id);
													toast.success('Access revoked');
												} catch (error) {
													console.error('Failed to revoke access:', error);
													toast.error('Failed to revoke access');
												}
											}}
											class="text-red-500 hover:text-red-700 text-sm"
											title="Remove access"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-gray-500">Not shared with anyone</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Access Modal -->
{#if showAccessModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => { showAccessModal = false; selectedUsers = []; searchQuery = ''; searchResults = []; }}>
		<div class="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-xl font-bold mb-4">Share File</h3>
			<input
				type="text"
				bind:value={searchQuery}
				oninput={searchUsers}
				placeholder="Search users or groups..."
				class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
			/>
			{#if searchResults.length > 0}
				<div class="mb-4 max-h-60 overflow-y-auto">
					{#each searchResults as item}
						<div
							class="p-3 border border-gray-200 rounded mb-2 cursor-pointer hover:bg-gray-50 {selectedUsers.find(u => u.id === item.id) ? 'bg-blue-50 border-blue-300' : ''}"
							onclick={() => {
								if (selectedUsers.find(u => u.id === item.id)) {
									selectedUsers = selectedUsers.filter(u => u.id !== item.id);
								} else {
									selectedUsers = [...selectedUsers, item];
								}
							}}
						>
							<div class="flex items-center gap-2">
								{#if item.type === 'group'}
									<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
									</svg>
									<div class="flex-1">
										<div class="font-medium text-gray-900">{item.name}</div>
										<div class="text-xs text-gray-500">{item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}</div>
									</div>
								{:else}
									<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
									</svg>
									<div class="flex-1">
										<div class="font-medium text-gray-900">{item.name || item.ename}</div>
										{#if item.name && item.ename}
											<div class="text-xs text-gray-500">@{item.ename.replace(/^@+/, '')}</div>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
			<div class="flex gap-2 justify-end">
				<button
					onclick={() => { showAccessModal = false; selectedUsers = []; searchQuery = ''; searchResults = []; }}
					class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
				>
					Cancel
				</button>
				<button
					onclick={handleGrantAccess}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
				>
					Share
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Tag Modal -->
{#if showTagModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => { showTagModal = false; selectedTag = null; tagInput = ''; }}>
		<div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-xl font-bold mb-4">Add Tag</h3>
			<div class="mb-4">
				<input
					type="text"
					bind:value={tagInput}
					oninput={handleTagSearch}
					placeholder="Search or create tag..."
					class="w-full px-4 py-2 border border-gray-300 rounded-lg"
					onkeydown={(e) => {
						if (e.key === 'Enter' && tagInput.trim()) {
							handleCreateOrSelectTag();
						}
					}}
				/>
				{#if filteredTags.length > 0 || tagInput.trim()}
					<div class="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
						{#if filteredTags.length > 0}
							{#each filteredTags as tag}
								<div
									class="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
									onclick={() => {
										selectedTag = tag.id;
										handleAddTag();
									}}
								>
									<div class="flex items-center gap-2">
										<span class="text-sm font-medium">{tag.name}</span>
										{#if tag.color}
											<span class="w-4 h-4 rounded-full" style="background-color: {tag.color}"></span>
										{/if}
									</div>
								</div>
							{/each}
						{/if}
						{#if tagInput.trim() && !filteredTags.find(t => t.name.toLowerCase() === tagInput.trim().toLowerCase())}
							<div
								class="px-4 py-2 hover:bg-gray-100 cursor-pointer border-t border-gray-200 bg-gray-50"
								onclick={handleCreateOrSelectTag}
							>
								<div class="flex items-center gap-2 text-sm text-blue-600">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
									</svg>
									Create "{tagInput.trim()}"
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
			<div class="flex gap-2 justify-end">
				<button
					onclick={() => { showTagModal = false; selectedTag = null; tagInput = ''; }}
					class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

