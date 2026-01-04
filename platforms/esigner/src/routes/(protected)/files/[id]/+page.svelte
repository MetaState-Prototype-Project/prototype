<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { apiClient } from '$lib/utils/axios';
	import { signatures, fetchFileSignatures, createSigningSession } from '$lib/stores/signatures';
	import { isAuthenticated, currentUser } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { qrcode } from 'svelte-qrcode-action';
	import { PUBLIC_ESIGNER_BASE_URL } from '$env/static/public';
	import { toast } from '$lib/stores/toast';

	let file = $state<any>(null);
	let invitations = $state<any[]>([]);
	let isLoading = $state(false);
	let showSignModal = $state(false);
	let signingSession = $state<any>(null);
	let sseConnection: EventSource | null = null;
	let previewUrl = $state<string | null>(null);
	let hasUserSigned = $state(false);
	let showDownloadModal = $state(false);

	onMount(async () => {
		isAuthenticated.subscribe((auth) => {
			if (!auth) {
				goto('/auth');
			}
		});

		const fileId = $page.params.id;
		await loadFile(fileId);
		await fetchFileSignatures(fileId);
		
		// Watch for signature changes
		signatures.subscribe(() => {
			checkIfUserSigned();
		});
		
		// Watch for user changes
		currentUser.subscribe(() => {
			checkIfUserSigned();
		});
	});

	async function loadFile(fileId: string) {
		try {
			isLoading = true;
			const [fileRes, invRes] = await Promise.all([
				apiClient.get(`/api/files/${fileId}`),
				apiClient.get(`/api/files/${fileId}/invitations`)
			]);
			file = fileRes.data;
			invitations = invRes.data;
			checkIfUserSigned();
			createPreview();
		} catch (err) {
			console.error('Failed to load file:', err);
			toast.error('Failed to load signature container');
		} finally {
			isLoading = false;
		}
	}

	function checkIfUserSigned() {
		if (!$currentUser || !$signatures) {
			hasUserSigned = false;
			return;
		}
		hasUserSigned = $signatures.some(sig => sig.userId === $currentUser.id);
	}

	async function createPreview() {
		if (!file) return;
		
		const isImage = file.mimeType?.startsWith('image/');
		const isPDF = file.mimeType === 'application/pdf';
		
		if (isImage || isPDF) {
			try {
				const response = await apiClient.get(`/api/files/${file.id}/download`, {
					responseType: 'blob'
				});
				const blob = new Blob([response.data], { type: file.mimeType });
				// Clean up old URL if exists
				if (previewUrl) {
					URL.revokeObjectURL(previewUrl);
				}
				previewUrl = URL.createObjectURL(blob);
			} catch (err) {
				console.error('Failed to load preview:', err);
			}
		}
	}

	async function handleSign() {
		try {
			const session = await createSigningSession(file.id);
			signingSession = session;
			showSignModal = true;
			watchSigningSession(session.sessionId);
		} catch (err) {
			console.error('Failed to create signing session:', err);
			toast.error('Failed to create signing session. Make sure you have a pending invitation.');
		}
	}

	function watchSigningSession(sessionId: string) {
		const baseUrl = PUBLIC_ESIGNER_BASE_URL || 'http://localhost:3004';
		const sseUrl = new URL(`/api/signatures/session/${sessionId}`, baseUrl).toString();
		sseConnection = new EventSource(sseUrl);

		sseConnection.onmessage = (e) => {
			const data = JSON.parse(e.data);
			if (data.type === 'signed' && data.status === 'completed') {
				showSignModal = false;
				sseConnection?.close();
				toast.success('Signature container signed successfully!');
				setTimeout(async () => {
					await loadFile(file.id);
					await fetchFileSignatures(file.id);
					checkIfUserSigned();
				}, 500);
			} else if (data.type === 'expired') {
				showSignModal = false;
				sseConnection?.close();
				toast.error('Signing session expired. Please try again.');
			} else if (data.type === 'security_violation') {
				showSignModal = false;
				sseConnection?.close();
				toast.error('Security violation detected. Signing failed.');
			}
		};

		sseConnection.onerror = () => {
			sseConnection?.close();
		};
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function hasPendingInvitation(): boolean {
		// Check if current user has a pending invitation
		// This will be checked on the backend when creating signing session
		return invitations.some(inv => inv.status === 'pending');
	}

	function allPartiesSigned(): boolean {
		if (invitations.length === 0) return false;
		return invitations.every(inv => inv.status === 'signed');
	}

	function getCombinedSignees() {
		// Create a map of user IDs to their signature data
		const signatureMap = new Map();
		$signatures.forEach(sig => {
			signatureMap.set(sig.userId, sig);
		});

		// Combine invitations with their signature data if they've signed
		return invitations.map(inv => {
			const signature = signatureMap.get(inv.userId);
			return {
				...inv,
				signature: signature || null,
				hasSigned: !!signature
			};
		});
	}

	async function downloadDocument() {
		try {
			const response = await apiClient.get(`/api/files/${file.id}/download`, {
				responseType: 'blob'
			});
			const blob = new Blob([response.data], { type: file.mimeType });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = file.name;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			showDownloadModal = false;
		} catch (err) {
			console.error('Failed to download document:', err);
			toast.error('Failed to download document');
		}
	}

	async function downloadProof() {
		if (!file || !$signatures) {
			toast.error('Unable to generate proof');
			return;
		}

		if (!allPartiesSigned()) {
			toast.error('All parties must sign before downloading proof');
			return;
		}

		try {
			// Build proof JSON
			const proof = {
				proof: {
					version: '1.0',
					generatedAt: new Date().toISOString(),
					file: {
						id: file.id,
						name: file.name,
						mimeType: file.mimeType,
						size: file.size,
						md5Hash: file.md5Hash,
						createdAt: file.createdAt,
					},
					signatures: $signatures.map(sig => ({
						id: sig.id,
						user: {
							name: sig.user?.name,
							ename: sig.user?.ename,
						},
						message: sig.message,
						signature: sig.signature,
						md5Hash: sig.md5Hash,
						signedAt: sig.createdAt,
					})),
					summary: {
						totalSignatures: $signatures.length,
						totalSignees: invitations.length,
						signedSignees: invitations.filter(inv => inv.status === 'signed').length,
						pendingSignees: invitations.filter(inv => inv.status === 'pending').length,
					}
				}
			};

			// Create and download JSON file
			const jsonString = JSON.stringify(proof, null, 2);
			const blob = new Blob([jsonString], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${file.name.replace(/\.[^/.]+$/, '')}_proof.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			showDownloadModal = false;
			toast.success('Proof downloaded successfully');
		} catch (err) {
			console.error('Failed to generate proof:', err);
			toast.error('Failed to generate proof');
		}
	}
</script>

<!-- Main Content: Split Layout -->
<main class="h-[calc(100vh-5rem)] flex flex-col overflow-hidden">
		<!-- Page Header -->
		<div class="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
			<a href="/files" class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mb-2">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
				Back to Signature Containers
			</a>
			<h1 class="text-2xl font-bold text-gray-900">{file?.name || 'Signature Container'}</h1>
		</div>
		
		<div class="flex-1 flex overflow-hidden">
			{#if isLoading}
				<div class="flex-1 flex items-center justify-center">
					<div class="text-center">
						<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
						<p class="text-gray-600">Loading...</p>
					</div>
				</div>
			{:else if file}
			<!-- Left Side: Preview (70%) -->
			<div class="flex-[0.7] bg-gray-100 overflow-auto flex items-center justify-center p-8">
				{#if previewUrl}
					{#if file.mimeType?.startsWith('image/')}
						<div class="max-w-full max-h-full shadow-2xl rounded-lg overflow-hidden bg-white">
							<img src={previewUrl} alt={file.name} class="max-w-full max-h-[calc(100vh-12rem)] object-contain" />
						</div>
					{:else if file.mimeType === 'application/pdf'}
						<div class="w-full h-full max-h-[calc(100vh-12rem)] shadow-2xl rounded-lg overflow-hidden bg-white">
							<iframe
								src={previewUrl}
								class="w-full h-full border-0"
								title={file.name}
							></iframe>
						</div>
					{:else}
						<div class="bg-white rounded-lg shadow-lg p-12 text-center max-w-md">
							<div class="text-6xl mb-4">📄</div>
							<p class="text-gray-600 mb-2">Preview not available for this file type</p>
							<p class="text-sm text-gray-500">{file.mimeType}</p>
							<button
								onclick={() => showDownloadModal = true}
								class="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
							>
								Download File
							</button>
						</div>
					{/if}
				{:else}
					<div class="bg-white rounded-lg shadow-lg p-12 text-center max-w-md">
						<div class="text-6xl mb-4">📄</div>
						<p class="text-gray-600 mb-2">Preview not available</p>
						<button
							onclick={() => showDownloadModal = true}
							class="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
						>
							Download File
						</button>
					</div>
				{/if}
			</div>

			<!-- Right Side: Metadata Sidebar (30%) -->
			<div class="flex-[0.3] bg-white border-l border-gray-200 overflow-y-auto">
				<div class="p-6 space-y-6">
					<!-- File Info -->
					<div>
						<h2 class="text-sm font-semibold text-gray-900 mb-3">File Information</h2>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-gray-600">Size:</span>
								<span class="text-gray-900 font-medium">{formatFileSize(file.size)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600">Type:</span>
								<span class="text-gray-900 font-medium">{file.mimeType}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600">Created:</span>
								<span class="text-gray-900 font-medium">{new Date(file.createdAt).toLocaleDateString()}</span>
							</div>
						</div>
					</div>

					<!-- Actions -->
					<div class="border-t border-gray-200 pt-6">
						<h2 class="text-sm font-semibold text-gray-900 mb-3">Actions</h2>
						<div class="space-y-2">
							<button
								onclick={() => showDownloadModal = true}
								class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
							>
								Download
							</button>
							{#if !hasUserSigned}
								<button
									onclick={handleSign}
									class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
								>
									Sign Signature Container
								</button>
							{:else}
								<button
									disabled
									class="w-full px-4 py-2 bg-green-100 text-green-700 rounded-lg cursor-not-allowed text-sm font-medium"
								>
									✓ Already Signed
								</button>
							{/if}
						</div>
					</div>

					<!-- Signees -->
					<div class="border-t border-gray-200 pt-6">
						<h2 class="text-sm font-semibold text-gray-900 mb-3">
							Signees <span class="text-gray-500 font-normal">({invitations.length})</span>
						</h2>
						{#if invitations.length === 0}
							<p class="text-sm text-gray-500 text-center py-4">No signees invited yet</p>
						{:else}
							<div class="space-y-2">
								{#each getCombinedSignees() as signee}
									<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
										<div class={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
											signee.hasSigned ? 'bg-blue-100' : 'bg-gray-200'
										}`}>
											<span class={`font-semibold text-xs ${
												signee.hasSigned ? 'text-blue-600' : 'text-gray-600'
											}`}>
												{signee.user?.name?.[0] || signee.user?.ename?.[0] || '?'}
											</span>
										</div>
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium text-gray-900 truncate">
												{signee.user?.name || signee.user?.ename || 'Unknown User'}
											</p>
											<p class="text-xs text-gray-500">
												{#if signee.hasSigned && signee.signature}
													Signed on {new Date(signee.signature.createdAt).toLocaleDateString()}
												{:else}
													Invited {new Date(signee.invitedAt).toLocaleDateString()}
												{/if}
											</p>
										</div>
										{#if signee.hasSigned}
											<span class="text-green-600 text-xs font-semibold">✓ Signed</span>
										{:else if signee.status === 'declined'}
											<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
												Declined
											</span>
										{:else}
											<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
												Pending
											</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
					</div>
				</div>
			{/if}
		</div>
	</main>

	<!-- Download Modal -->
	{#if showDownloadModal}
		<div
			class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
			onclick={() => showDownloadModal = false}
		>
			<div
				class="bg-white rounded-lg max-w-md w-full p-6"
				onclick={(e) => e.stopPropagation()}
			>
				<h3 class="text-xl font-bold text-gray-900 mb-4">Download Options</h3>
				<p class="text-gray-600 mb-6">Choose what you would like to download:</p>
				
				<div class="space-y-3">
					<button
						onclick={downloadDocument}
						class="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						Download Document
					</button>
					
					<button
						onclick={downloadProof}
						disabled={!allPartiesSigned()}
						class="w-full px-4 py-3 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed {allPartiesSigned() ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-50 text-gray-400'}"
						title={allPartiesSigned() ? '' : 'All parties must sign before downloading proof'}
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						Download Proof
					</button>
				</div>

				<button
					onclick={() => showDownloadModal = false}
					class="w-full mt-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	<!-- Signing Modal -->
	{#if showSignModal && signingSession}
		<div
			class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
			onclick={() => {
				showSignModal = false;
				sseConnection?.close();
			}}
		>
			<div
				class="bg-white rounded-lg max-w-md w-full p-6"
				onclick={(e) => e.stopPropagation()}
			>
				<h3 class="text-xl font-bold text-gray-900 mb-4">Sign Signature Container</h3>
				<p class="text-gray-600 mb-6">Scan this QR code with your eID Wallet to sign the signature container</p>
				
				<div class="flex justify-center mb-6">
					<article
						class="overflow-hidden rounded-2xl bg-white p-4"
						use:qrcode={{
							data: signingSession.qrData,
							width: 250,
							height: 250,
							margin: 12,
							type: 'canvas'
						}}
					></article>
				</div>

				<p class="text-sm text-gray-500 text-center mb-4">
					Waiting for signature...
				</p>

				<button
					onclick={() => {
						showSignModal = false;
						sseConnection?.close();
					}}
					class="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

