<script lang="ts">
	import { onMount } from 'svelte';
	import { invitations, fetchInvitations } from '$lib/stores/invitations';
	import { documents, fetchDocuments, isLoading } from '$lib/stores/files';
	import { isAuthenticated } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { logout } from '$lib/stores/auth';
	import type { Document } from '$lib/stores/files';

	function getStatusBadge(status: Document['status']) {
		switch (status) {
			case 'draft':
				return { text: 'Draft', class: 'bg-gray-100 text-gray-700' };
			case 'pending':
				return { text: 'Pending', class: 'bg-yellow-100 text-yellow-700' };
			case 'partially_signed':
				return { text: 'Partially Signed', class: 'bg-blue-100 text-blue-700' };
			case 'fully_signed':
				return { text: 'Fully Signed', class: 'bg-green-100 text-green-700' };
			default:
				return { text: 'Unknown', class: 'bg-gray-100 text-gray-700' };
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	onMount(() => {
		isAuthenticated.subscribe((auth) => {
			if (!auth) {
				goto('/auth');
			} else {
				fetchInvitations();
				fetchDocuments();
			}
		});
	});
</script>

<main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Header with Action -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h2 class="text-3xl font-bold text-gray-900 mb-2">Signature Containers</h2>
				<p class="text-gray-600">Manage your signature containers and signed files</p>
			</div>
			<a
				href="/files/new"
				class="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
			>
				+ New Signature Container
			</a>
		</div>

		<!-- Pending Invitations -->
		{#if $invitations.length > 0}
			<div class="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
				<h3 class="font-semibold text-yellow-900 mb-4 text-lg">Pending Signing Requests</h3>
				<div class="space-y-3">
					{#each $invitations as inv}
						<div class="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm">
							<div class="flex-1">
								<p class="font-medium text-gray-900">{inv.file?.displayName || inv.file?.name || 'Unknown Signature Container'}</p>
								<p class="text-sm text-gray-600">Invited {new Date(inv.invitedAt).toLocaleDateString()}</p>
							</div>
							<a
								href="/files/{inv.fileId}"
								class="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
							>
								View & Sign
							</a>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Documents List -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200">
			<div class="p-6 border-b border-gray-200">
				<h3 class="text-lg font-semibold text-gray-900">All Signature Containers</h3>
			</div>
			
			{#if $isLoading}
				<div class="p-12 text-center">
					<p class="text-gray-500">Loading documents...</p>
				</div>
			{:else if $documents.length === 0}
				<div class="p-12 text-center">
					<div class="text-6xl mb-4">📄</div>
					<h3 class="text-lg font-semibold text-gray-900 mb-2">No signature containers yet</h3>
					<p class="text-gray-600 mb-4">Create your first signature container to get started</p>
					<a
						href="/files/new"
						class="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
					>
						Create Signature Container
					</a>
				</div>
			{:else}
				<div class="divide-y divide-gray-200">
					{#each $documents as doc}
						<a href="/files/{doc.id}" class="block p-6 hover:bg-gray-50 transition-colors">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<div class="flex items-center gap-3 mb-2">
										<h4 class="font-semibold text-gray-900">{doc.displayName || doc.name}</h4>
										<span class="px-2 py-1 text-xs font-medium rounded {getStatusBadge(doc.status).class}">
											{getStatusBadge(doc.status).text}
										</span>
									</div>
									{#if doc.description}
										<p class="text-sm text-gray-600 mb-2">{doc.description}</p>
									{/if}
									<div class="flex items-center gap-4 text-sm text-gray-600 mb-2">
										<span>{formatFileSize(doc.size)}</span>
										<span>•</span>
										<span>{doc.totalSignees} {doc.totalSignees === 1 ? 'signee' : 'signees'}</span>
										{#if doc.signedCount > 0}
											<span>•</span>
											<span class="text-green-600 font-medium">{doc.signedCount} signed</span>
										{/if}
										{#if doc.pendingCount > 0}
											<span>•</span>
											<span class="text-yellow-600 font-medium">{doc.pendingCount} pending</span>
										{/if}
									</div>
									{#if doc.signatures.length > 0}
										<div class="flex items-center gap-2 mt-2">
											<span class="text-xs text-gray-500">Signature Containers:</span>
											<div class="flex items-center gap-1">
												{#each doc.signatures.slice(0, 3) as sig}
													<div class="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center" title={sig.user?.name || sig.user?.ename || 'Unknown'}>
														<span class="text-xs text-blue-600 font-medium">
															{(sig.user?.name || sig.user?.ename || '?')[0].toUpperCase()}
														</span>
													</div>
												{/each}
												{#if doc.signatures.length > 3}
													<span class="text-xs text-gray-500">+{doc.signatures.length - 3}</span>
												{/if}
											</div>
										</div>
									{/if}
									<p class="text-xs text-gray-500 mt-2">
										Created {new Date(doc.createdAt).toLocaleDateString()} • 
										Last updated {new Date(doc.updatedAt).toLocaleDateString()}
									</p>
								</div>
								<div class="ml-4">
									<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</main>
