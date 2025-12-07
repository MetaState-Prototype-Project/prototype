<script lang="ts">
	import { goto } from '$app/navigation';
	import { PUBLIC_PICTIQUE_BASE_URL } from '$env/static/public';
	import { setAuthId, setAuthToken } from '$lib/utils';
	import { onMount } from 'svelte';

	let isLoading = $state(true);
	let error = $state<string | null>(null);

	async function handleDeeplinkLogin() {
		try {
			// Try parsing from search string first
			let params: URLSearchParams;
			let searchString = window.location.search;

			// If search is empty, try parsing from hash or full URL
			if (!searchString || searchString === '') {
				const hash = window.location.hash;
				if (hash && hash.includes('?')) {
					searchString = hash.substring(hash.indexOf('?'));
				} else {
					try {
						const fullUrl = new URL(window.location.href);
						searchString = fullUrl.search;
					} catch (e) {
						// Ignore parsing errors
					}
				}
			}

			// Remove leading ? if present
			if (searchString.startsWith('?')) {
				searchString = searchString.substring(1);
			}

			// Parse the search string
			params = new URLSearchParams(searchString);

			const ename = params.get('ename');
			const session = params.get('session');
			const signature = params.get('signature');
			const appVersion = params.get('appVersion');

			if (!ename || !session || !signature) {
				error = 'Missing required authentication parameters';
				isLoading = false;
				return;
			}

			// Clean up URL
			window.history.replaceState({}, '', window.location.pathname);

			// Make POST request to login endpoint
			const loginUrl = `${PUBLIC_PICTIQUE_BASE_URL}/api/auth`;
			const requestBody = { ename, session, signature, appVersion: appVersion || '0.4.0' };

			const response = await fetch(loginUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			if (response.ok) {
				const data = await response.json();
				if (data.token && data.user) {
					setAuthId(data.user.id);
					setAuthToken(data.token);
					goto('/home');
				} else {
					error = 'Invalid response from server';
					isLoading = false;
				}
			} else {
				let errorData;
				try {
					errorData = await response.json();
				} catch (parseError) {
					errorData = { error: `Server error: ${response.status}` };
				}
				error = errorData.error || 'Authentication failed';
				isLoading = false;
			}
		} catch (err) {
			console.error('Login request failed:', err);
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
			<div class="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto mb-4"></div>
			<p class="text-lg text-gray-600">Authenticating...</p>
		</div>
	</div>
{:else if error}
	<div class="flex h-screen items-center justify-center">
		<div class="text-center">
			<div class="text-red-600 mb-4">{error}</div>
			<button
				onclick={() => goto('/auth')}
				class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
			>
				Go to Login
			</button>
		</div>
	</div>
{/if}
