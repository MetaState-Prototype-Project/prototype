<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';
	import { files, fetchFiles, uploadFile } from '$lib/stores/files';
	import { apiClient } from '$lib/utils/axios';
	import { inviteSignees } from '$lib/stores/invitations';

	let currentStep = $state(1);
	let selectedFile = $state<any>(null);
	let uploadedFile = $state<File | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<any[]>([]);
	let selectedUsers = $state<any[]>([]);
	let isLoading = $state(false);
	let isSubmitting = $state(false);
	let dragOver = $state(false);
	let currentUserId = $state<string | null>(null);
	let displayName = $state('');
	let description = $state('');

	onMount(async () => {
		isAuthenticated.subscribe((auth) => {
			if (!auth) {
				goto('/auth');
			}
		});
		
		// Get current user ID from API
		try {
			const response = await apiClient.get('/api/users');
			currentUserId = response.data.id;
		} catch (err) {
			console.error('Failed to get current user:', err);
		}
		
		fetchFiles();
	});

	async function handleFileUpload(file: File) {
		try {
			isLoading = true;
			// Set default display name to file name if not set
			const nameToUse = displayName.trim() || file.name;
			const result = await uploadFile(file, nameToUse, description.trim() || undefined);
			uploadedFile = file;
			selectedFile = result;
			// Update displayName if it was empty
			if (!displayName.trim()) {
				displayName = file.name;
			}
		} catch (err) {
			console.error('Upload failed:', err);
			alert('Failed to upload file');
			throw err;
		} finally {
			isLoading = false;
		}
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			// Don't upload immediately - just store the file
			uploadedFile = target.files[0];
			selectedFile = null;
			// Set default display name
			if (!displayName.trim()) {
				displayName = target.files[0].name;
			}
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
			// Don't upload immediately - just store the file
			uploadedFile = event.dataTransfer.files[0];
			selectedFile = null;
			// Set default display name
			if (!displayName.trim()) {
				displayName = event.dataTransfer.files[0].name;
			}
		}
	}

	async function searchUsers() {
		if (searchQuery.length < 2) {
			searchResults = [];
			return;
		}

		try {
			isLoading = true;
			const response = await apiClient.get('/api/users/search', {
				params: { query: searchQuery, limit: 10 }
			});
			searchResults = response.data;
		} catch (err) {
			console.error('Search failed:', err);
			searchResults = [];
		} finally {
			isLoading = false;
		}
	}

	function addUser(user: any) {
		// Don't allow user to invite themselves
		if (currentUserId && user.id === currentUserId) {
			alert('You cannot invite yourself. You are automatically added as a signee.');
			return;
		}
		
		if (!selectedUsers.find(u => u.id === user.id)) {
			selectedUsers = [...selectedUsers, user];
		}
		searchQuery = '';
		searchResults = [];
	}

	function removeUser(userId: string) {
		selectedUsers = selectedUsers.filter(u => u.id !== userId);
	}

	async function handleSubmit() {
		if (!selectedFile) {
			alert('Please select a file');
			return;
		}

		try {
			isSubmitting = true;
			const userIds = selectedUsers.map(u => u.id);
			
			// Backend will automatically add owner as signee
			await inviteSignees(selectedFile.id, userIds);
			
			goto(`/files/${selectedFile.id}`);
		} catch (err) {
			console.error('Failed to create invitations:', err);
			alert('Failed to send invitations');
		} finally {
			isSubmitting = false;
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function getFileIcon(mimeType: string): string {
		if (mimeType.startsWith('image/')) return '🖼️';
		if (mimeType === 'application/pdf') return '📄';
		if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
		if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
		return '📎';
	}
</script>

<main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Page Header -->
		<div class="mb-8">
			<a href="/files" class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mb-4">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
				Back to Signature Containers
			</a>
			<h1 class="text-3xl font-bold text-gray-900">New Signature Container</h1>
		</div>
		<!-- Progress Steps -->
		<div class="mb-8">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
						currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
					}`}>
						1
					</div>
					<span class={currentStep >= 1 ? 'text-blue-600 font-medium' : 'text-gray-600'}>Upload File</span>
				</div>
				<div class="flex-1 h-0.5 mx-4 bg-gray-200">
					<div class={`h-full transition-all ${currentStep >= 2 ? 'bg-blue-600' : ''}`} style="width: {currentStep >= 2 ? '100%' : '0%'}"></div>
				</div>
				<div class="flex items-center gap-2">
					<div class={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
						currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
					}`}>
						2
					</div>
					<span class={currentStep >= 2 ? 'text-blue-600 font-medium' : 'text-gray-600'}>Invite Signees</span>
				</div>
				<div class="flex-1 h-0.5 mx-4 bg-gray-200">
					<div class={`h-full transition-all ${currentStep >= 3 ? 'bg-blue-600' : ''}`} style="width: {currentStep >= 3 ? '100%' : '0%'}"></div>
				</div>
				<div class="flex items-center gap-2">
					<div class={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
						currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
					}`}>
						3
					</div>
					<span class={currentStep >= 3 ? 'text-blue-600 font-medium' : 'text-gray-600'}>Review</span>
				</div>
			</div>
		</div>

		<!-- Step 1: Select File -->
		{#if currentStep === 1}
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
				<h2 class="text-2xl font-bold text-gray-900 mb-6">Upload File</h2>

				<!-- Upload New File -->
				<div class="mb-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Upload New File</h3>
					<div
						role="button"
						tabindex="0"
						class={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
							dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
						}`}
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
						ondrop={handleDrop}
					>
						{#if uploadedFile}
							<div class="mb-4">
								<div class="text-4xl mb-2">{getFileIcon(uploadedFile.type)}</div>
								<p class="font-medium text-gray-900">{uploadedFile.name}</p>
								<p class="text-sm text-gray-600">{formatFileSize(uploadedFile.size)}</p>
							</div>
							<button
								onclick={() => {
									uploadedFile = null;
									selectedFile = null;
									displayName = '';
									description = '';
								}}
								class="text-sm text-red-600 hover:text-red-700"
							>
								Remove
							</button>
						{:else}
							<div class="text-4xl mb-4">📤</div>
							<p class="text-gray-600 mb-2">Drag and drop a file here</p>
							<p class="text-sm text-gray-500 mb-4">or</p>
							<label
								for="file-input"
								class="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
							>
								Choose File
							</label>
							<input
								id="file-input"
								type="file"
								class="hidden"
								onchange={handleFileSelect}
								disabled={isLoading}
							/>
							{#if isLoading}
								<p class="mt-4 text-sm text-gray-600">Uploading...</p>
							{/if}
						{/if}
					</div>
				</div>

				<!-- Or Select Existing -->
				<div>
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Or Select Existing File</h3>
					{#if $files.length === 0}
						<p class="text-gray-600 text-center py-8">No files available</p>
					{:else}
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
							{#each $files as file}
								<button
									onclick={() => {
										selectedFile = file;
										displayName = file.displayName || file.name;
										description = file.description || '';
									}}
									class={`p-4 border-2 rounded-lg text-left transition-colors ${
										selectedFile?.id === file.id
											? 'border-blue-600 bg-blue-50'
											: 'border-gray-200 hover:border-gray-300'
									}`}
								>
									<div class="flex items-center gap-3">
										<span class="text-2xl">{getFileIcon(file.mimeType)}</span>
										<div class="flex-1 min-w-0">
											<p class="font-medium text-gray-900 truncate">{file.displayName || file.name}</p>
											<p class="text-sm text-gray-600">{formatFileSize(file.size)}</p>
										</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Signature Container Details -->
				{#if selectedFile || uploadedFile}
					<div class="mt-6 space-y-4">
						<div>
							<label for="display-name" class="block text-sm font-medium text-gray-700 mb-2">
								Signature Container Name <span class="text-gray-500">(optional)</span>
							</label>
							<input
								id="display-name"
								type="text"
								bind:value={displayName}
								placeholder={uploadedFile ? uploadedFile.name : selectedFile?.name || 'Enter a name for this signature container'}
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
							<p class="mt-1 text-sm text-gray-500">Give this signature container a descriptive name</p>
						</div>
						<div>
							<label for="description" class="block text-sm font-medium text-gray-700 mb-2">
								Description <span class="text-gray-500">(optional)</span>
							</label>
							<textarea
								id="description"
								bind:value={description}
								placeholder="Add any additional details about this signature container..."
								rows="3"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							></textarea>
						</div>
					</div>
				{/if}

				<div class="flex justify-end mt-6">
					<button
						onclick={async () => {
							if (uploadedFile && !selectedFile) {
								// Upload the file with name/description when proceeding
								try {
									await handleFileUpload(uploadedFile);
								} catch (err) {
									// Error already handled in handleFileUpload
									return;
								}
							} else if (selectedFile && !uploadedFile) {
								// Update existing file with new name/description if changed
								try {
									isLoading = true;
									const response = await apiClient.patch(`/api/files/${selectedFile.id}`, {
										displayName: displayName.trim() || selectedFile.name,
										description: description.trim() || null
									});
									selectedFile = response.data;
								} catch (err) {
									console.error('Failed to update file:', err);
									alert('Failed to update signature container details');
									return;
								} finally {
									isLoading = false;
								}
							}
							if (selectedFile || uploadedFile) {
								currentStep = 2;
							}
						}}
						disabled={(!selectedFile && !uploadedFile) || isLoading}
						class="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isLoading ? 'Saving...' : 'Next: Invite Signees'}
					</button>
				</div>
			</div>
		{/if}

		<!-- Step 2: Invite Signees -->
		{#if currentStep === 2}
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
				<h2 class="text-2xl font-bold text-gray-900 mb-6">Invite Signees</h2>

				<!-- Selected File Info -->
				<div class="mb-6 p-4 bg-gray-50 rounded-lg">
					<div class="flex items-center gap-3">
						<span class="text-2xl">{getFileIcon(selectedFile?.mimeType || '')}</span>
						<div>
							<p class="font-medium text-gray-900">{selectedFile?.name}</p>
							<p class="text-sm text-gray-600">{formatFileSize(selectedFile?.size || 0)}</p>
						</div>
					</div>
				</div>

				<!-- User Search -->
				<div class="mb-6">
					<label for="user-search-input" class="block text-sm font-medium text-gray-700 mb-2">Search Users</label>
					<input
						id="user-search-input"
						type="text"
						bind:value={searchQuery}
						oninput={searchUsers}
						placeholder="Search by name or ename..."
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
					{#if searchResults.length > 0}
						<div class="mt-2 border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
							{#each searchResults as user}
								<button
									onclick={() => addUser(user)}
									class="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0"
								>
									<div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
										<span class="text-blue-600 font-semibold">
											{user.name?.[0] || user.ename?.[0] || '?'}
										</span>
									</div>
									<div class="flex-1">
										<p class="font-medium text-gray-900">{user.name || 'No name'}</p>
										<p class="text-sm text-gray-600">{user.ename}</p>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Selected Users -->
				<div>
					<h3 class="block text-sm font-medium text-gray-700 mb-2">
						Selected Signees ({selectedUsers.length})
					</h3>
					{#if selectedUsers.length === 0}
						<p class="text-gray-600 text-center py-8 bg-gray-50 rounded-lg">
							No additional signees. You can skip this step to create a self-signed document.
						</p>
					{:else}
						<div class="space-y-2">
							{#each selectedUsers as user}
								<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
									<div class="flex items-center gap-3">
										<div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
											<span class="text-blue-600 font-semibold">
												{user.name?.[0] || user.ename?.[0] || '?'}
											</span>
										</div>
										<div>
											<p class="font-medium text-gray-900">{user.name || 'No name'}</p>
											<p class="text-sm text-gray-600">{user.ename}</p>
										</div>
									</div>
									<button
										onclick={() => removeUser(user.id)}
										class="text-red-600 hover:text-red-700 px-3 py-1"
									>
										Remove
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="flex justify-between mt-6">
					<button
						onclick={() => currentStep = 1}
						class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
					>
						Back
					</button>
					<div class="flex gap-3">
						<button
							onclick={() => currentStep = 3}
							class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
						>
							Skip
						</button>
						<button
							onclick={() => currentStep = 3}
							class="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
						>
							Next: Review
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Step 3: Review -->
		{#if currentStep === 3}
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
				<h2 class="text-2xl font-bold text-gray-900 mb-6">Review & Confirm</h2>

				<!-- File Summary -->
				<div class="mb-6 p-4 bg-gray-50 rounded-lg">
					<h3 class="font-semibold text-gray-900 mb-3">File</h3>
					<div class="flex items-center gap-3">
						<span class="text-2xl">{getFileIcon(selectedFile?.mimeType || '')}</span>
						<div>
							<p class="font-medium text-gray-900">{selectedFile?.name}</p>
							<p class="text-sm text-gray-600">{formatFileSize(selectedFile?.size || 0)}</p>
						</div>
					</div>
				</div>

				<!-- Signees Summary -->
				<div class="mb-6">
					<h3 class="font-semibold text-gray-900 mb-3">Signees ({selectedUsers.length + 1})</h3>
					<div class="space-y-2">
						<!-- Owner (automatically added) -->
						<div class="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
							<div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
								<span class="text-white font-semibold">You</span>
							</div>
							<div>
								<p class="font-medium text-gray-900">You (Owner)</p>
								<p class="text-sm text-gray-600">Automatically added as signee</p>
							</div>
						</div>
						<!-- Invited users -->
						{#each selectedUsers as user}
							<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
								<div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
									<span class="text-blue-600 font-semibold">
										{user.name?.[0] || user.ename?.[0] || '?'}
									</span>
								</div>
								<div>
									<p class="font-medium text-gray-900">{user.name || 'No name'}</p>
									<p class="text-sm text-gray-600">{user.ename}</p>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Notification text -->
				<div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
					<p class="text-sm text-blue-800">
						<strong>Note:</strong> All signees will be notified automatically once the signing container is created.
					</p>
				</div>

				<div class="flex justify-between mt-6">
					<button
						onclick={() => currentStep = 2}
						class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
					>
						Back
					</button>
					<button
						onclick={handleSubmit}
						disabled={isSubmitting}
						class="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isSubmitting ? 'Creating...' : 'Create Signing Container'}
					</button>
				</div>
			</div>
		{/if}
	</main>

