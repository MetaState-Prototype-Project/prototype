<script lang="ts">
	import { goto } from '$app/navigation';
	import { PUBLIC_PICTIQUE_BASE_URL } from '$env/static/public';
	import { setAuthId, setAuthToken } from '$lib/utils';
	import { onMount } from 'svelte';

	let isLoading = $state(true);
	let error = $state<string | null>(null);

	async function handleDeeplinkLogin() {
		try {
			console.log('[PICTIQUE DEEPLINK] Starting deeplink login');
			console.log('[PICTIQUE DEEPLINK] Full URL:', window.location.href);
			console.log('[PICTIQUE DEEPLINK] window.location.search:', window.location.search);
			console.log('[PICTIQUE DEEPLINK] window.location.hash:', window.location.hash);

			// Try parsing from search string first
			let params: URLSearchParams;
			let searchString = window.location.search;
			console.log('[PICTIQUE DEEPLINK] Initial searchString:', searchString);

			// If search is empty, try parsing from hash or full URL
			if (!searchString || searchString === '') {
				console.log('[PICTIQUE DEEPLINK] Search string empty, trying hash');
				const hash = window.location.hash;
				console.log('[PICTIQUE DEEPLINK] Hash value:', hash);
				if (hash && hash.includes('?')) {
					searchString = hash.substring(hash.indexOf('?'));
					console.log(
						'[PICTIQUE DEEPLINK] Extracted searchString from hash:',
						searchString
					);
				} else {
					try {
						const fullUrl = new URL(window.location.href);
						searchString = fullUrl.search;
						console.log(
							'[PICTIQUE DEEPLINK] Extracted searchString from full URL:',
							searchString
						);
					} catch (e) {
						console.error('[PICTIQUE DEEPLINK] Error parsing full URL:', e);
						// Ignore parsing errors
					}
				}
			}

			// Remove leading ? if present
			if (searchString.startsWith('?')) {
				searchString = searchString.substring(1);
			}
			console.log('[PICTIQUE DEEPLINK] Final searchString after cleanup:', searchString);

			// Parse the search string
			params = new URLSearchParams(searchString);
			console.log('[PICTIQUE DEEPLINK] All params:', Object.fromEntries(params.entries()));

			const ename = params.get('ename');
			const session = params.get('session');
			const signature = params.get('signature');
			const appVersion = params.get('appVersion');

			console.log('[PICTIQUE DEEPLINK] Extracted values:');
			console.log('  - ename:', ename ? `${ename.substring(0, 10)}...` : 'MISSING');
			console.log('  - session:', session ? `${session.substring(0, 10)}...` : 'MISSING');
			console.log(
				'  - signature:',
				signature ? `${signature.substring(0, 10)}...` : 'MISSING'
			);
			console.log('  - appVersion:', appVersion || 'not provided');

			if (!ename || !session || !signature) {
				const missing = [];
				if (!ename) missing.push('ename');
				if (!session) missing.push('session');
				if (!signature) missing.push('signature');
				console.error('[PICTIQUE DEEPLINK] Missing parameters:', missing.join(', '));
				error = `Missing required authentication parameters: ${missing.join(', ')}`;
				isLoading = false;
				return;
			}

			// Clean up URL
			window.history.replaceState({}, '', window.location.pathname);

			// Make POST request to login endpoint
			const loginUrl = `${PUBLIC_PICTIQUE_BASE_URL}/api/auth`;
			const requestBody = { ename, session, signature, appVersion: appVersion || '0.4.0' };
			console.log('[PICTIQUE DEEPLINK] Making request to:', loginUrl);
			console.log('[PICTIQUE DEEPLINK] Request body (sanitized):', {
				ename: ename ? `${ename.substring(0, 10)}...` : null,
				session: session ? `${session.substring(0, 10)}...` : null,
				signature: signature ? `${signature.substring(0, 10)}...` : null,
				appVersion: appVersion || '0.4.0'
			});

			const response = await fetch(loginUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			console.log(
				'[PICTIQUE DEEPLINK] Response status:',
				response.status,
				response.statusText
			);

			if (response.ok) {
				const data = await response.json();
				console.log('[PICTIQUE DEEPLINK] Response data:', {
					hasToken: !!data.token,
					hasUser: !!data.user,
					userId: data.user?.id,
					tokenPreview: data.token ? `${data.token.substring(0, 20)}...` : null
				});
				if (data.token && data.user) {
					console.log('[PICTIQUE DEEPLINK] Authentication successful, setting tokens');
					setAuthId(data.user.id);
					// setAuthToken already navigates to /home, so don't call goto() here
					setAuthToken(data.token);
				} else {
					console.error(
						'[PICTIQUE DEEPLINK] Invalid response structure - missing token or user'
					);
					console.error('[PICTIQUE DEEPLINK] Response data:', data);
					error = 'Invalid response from server';
					isLoading = false;
				}
			} else {
				let errorData;
				try {
					errorData = await response.json();
					console.error('[PICTIQUE DEEPLINK] Server error response:', errorData);
				} catch (parseError) {
					console.error(
						'[PICTIQUE DEEPLINK] Failed to parse error response:',
						parseError
					);
					errorData = { error: `Server error: ${response.status}` };
				}
				error = errorData.error || 'Authentication failed';
				isLoading = false;
			}
		} catch (err) {
			console.error('[PICTIQUE DEEPLINK] Login request failed:', err);
			console.error(
				'[PICTIQUE DEEPLINK] Error stack:',
				err instanceof Error ? err.stack : 'No stack trace'
			);
			error = 'Failed to connect to server';
			isLoading = false;
		}
	}

	onMount(() => {
		handleDeeplinkLogin();
	});
</script>

{#if isLoading}
	<div class="flex h-screen items-center justify-center">
		<div class="text-center">
			<div
				class="mx-auto mb-4 h-32 w-32 animate-spin rounded-full border-b-2 border-gray-900"
			></div>
			<p class="text-lg text-gray-600">Authenticating...</p>
		</div>
	</div>
{:else if error}
	<div class="flex h-screen items-center justify-center">
		<div class="text-center">
			<div class="mb-4 text-red-600">{error}</div>
			<button
				onclick={() => goto('/auth')}
				class="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
			>
				Go to Login
			</button>
		</div>
	</div>
{/if}
