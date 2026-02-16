<script lang="ts">
	import { goto } from '$app/navigation';
	import { PUBLIC_FILE_MANAGER_BASE_URL } from '$env/static/public';
	import { apiClient } from '$lib/utils/axios';
	import { login } from '$lib/stores/auth';
	import { onMount, onDestroy } from 'svelte';
	import { qrcode } from 'svelte-qrcode-action';

	let qrData = $state<string>('');
	let errorMessage = $state<string | null>(null);

	function isMobileDevice(): boolean {
		return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent
		);
	}

	function getDeepLinkUrl(uri: string): string {
		if (isMobileDevice()) {
			return uri;
		}
		return uri;
	}

	function getAppStoreLink(): string {
		const userAgent =
			navigator.userAgent || navigator.vendor || (window as { opera?: string }).opera || '';
		if (/android/i.test(userAgent)) {
			return 'https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet';
		}

		if (/iPad|iPhone|iPod/.test(userAgent) && !('MSStream' in window)) {
			return 'https://apps.apple.com/in/app/eid-for-w3ds/id6747748667';
		}

		return 'https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet';
	}

	async function handleAutoLogin(
		ename: string,
		session: string,
		signature: string,
		appVersion: string
	) {
		try {
			const response = await fetch(`${PUBLIC_FILE_MANAGER_BASE_URL}/api/auth`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ename, session, signature, appVersion })
			});

			if (response.ok) {
				const data = await response.json();
				if (data.token && data.user) {
					await login(data.token, data.user);
					goto('/files');
				}
			} else {
				const errorData = await response.json();
				console.error('Login failed:', errorData);
				if (errorData.error && errorData.type === 'version_mismatch') {
					errorMessage =
						errorData.message ||
						'Your eID Wallet app version is outdated. Please update to continue.';
				}
			}
		} catch (error) {
			console.error('Login request failed:', error);
		}
	}

	onMount(async () => {
		// Check for query parameters and auto-login
		const params = new URLSearchParams(window.location.search);
		const ename = params.get('ename');
		const session = params.get('session');
		const signature = params.get('signature');
		const appVersion = params.get('appVersion');

		if (ename && session && signature) {
			// Clean up URL
			window.history.replaceState({}, '', window.location.pathname);

			// Auto-submit login
			await handleAutoLogin(ename, session, signature, appVersion || '0.4.0');
			return;
		}

		// If no query params, proceed with normal flow
		const { data } = await apiClient.get('/api/auth/offer');
		qrData = data.uri;

		function watchEventStream(id: string) {
			const sseUrl = new URL(`/api/auth/sessions/${id}`, PUBLIC_FILE_MANAGER_BASE_URL).toString();
			const eventSource = new EventSource(sseUrl);

			eventSource.onopen = () => {
				console.log('Successfully connected.');
				errorMessage = null;
			};

			eventSource.onmessage = async (e) => {
				const data = JSON.parse(e.data as string);

				// Check for error messages (version mismatch)
				if (data.error && data.type === 'version_mismatch') {
					errorMessage =
						data.message ||
						'Your eID Wallet app version is outdated. Please update to continue.';
					eventSource.close();
					return;
				}

				// Handle successful authentication
				if (data.user && data.token) {
					const { token, user } = data;
					await login(token, user);
					goto('/files');
				}
			};

			eventSource.onerror = () => {
				console.error('SSE connection error');
				eventSource.close();
			};
		}

		watchEventStream(new URL(qrData).searchParams.get('session') as string);
	});
</script>

<div class="flex min-h-screen w-full flex-col items-center justify-center p-4">
	<div class="mb-5 flex flex-col items-center gap-2 text-center">
		<!-- Logo -->
		<div class="mb-4">
			<div class="w-20 h-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-xl transform rotate-12">
				<svg class="w-10 h-10 text-white transform -rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
				</svg>
			</div>
		</div>
		<h1 class="text-3xl font-bold text-gray-900">File Manager</h1>
		<p class="text-gray-600">Manage your files with your eID Wallet</p>
	</div>

	<div
		class="mb-5 flex w-full max-w-[400px] flex-col items-center gap-5 rounded-xl bg-gray-100 p-5"
	>
		<h2>
			{#if isMobileDevice()}
				Login with your <a href={getAppStoreLink()}><b><u>eID Wallet</u></b></a>
			{:else}
				Scan the QR code using your <b><u class="text-sm">eID App</u></b> to login
			{/if}
		</h2>
		{#if errorMessage}
			<div class="mb-4 rounded-lg border border-red-400 bg-red-100 p-4 text-red-700">
				<p class="font-semibold">Authentication Error</p>
				<p class="text-sm">{errorMessage}</p>
			</div>
		{/if}
		{#if qrData}
			{#if isMobileDevice()}
				<div class="flex flex-col items-center gap-4">
					<a
						href={getDeepLinkUrl(qrData)}
						class="rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
					>
						Login with eID Wallet
					</a>
					<div class="max-w-xs text-center text-sm text-gray-600">
						Click the button to open your eID wallet app
					</div>
				</div>
			{:else}
				<article
					class="overflow-hidden rounded-2xl bg-white p-4"
					use:qrcode={{
						data: qrData,
						width: 250,
						height: 250,
						margin: 12,
						type: 'canvas'
					}}
				></article>
			{/if}
		{/if}

		<p class="text-center">
			<span class="mb-1 block font-bold text-gray-600"
				>The {isMobileDevice() ? 'button' : 'code'} is valid for 60 seconds</span
			>
			<span class="block font-light text-gray-600">Please refresh the page if it expires</span
			>
		</p>

		<p class="w-full rounded-md bg-white/60 p-4 text-center text-xs leading-4 text-black/40">
			You are entering File Manager - a cloud storage and file management platform built on the Web 3.0 Data Space
			(W3DS) architecture. Manage your files securely with your eID Wallet.
		</p>
	</div>
</div>

