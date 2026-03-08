<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import QRCode from 'qrcode';

	let offerUri = $state('');
	let sessionId = $state('');
	let qrDataUrl = $state('');
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let isMobile = $state(false);

	let eventSource: EventSource | null = null;
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;

	function cleanupSse() {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
	}

	function cleanupTimer() {
		if (refreshTimer) {
			clearTimeout(refreshTimer);
			refreshTimer = null;
		}
	}

	function detectMobile() {
		if (typeof window === 'undefined') return;
		isMobile = window.innerWidth < 768;
	}

	function setupSse(id: string) {
		cleanupSse();
		eventSource = new EventSource(`/api/auth/sessions/${encodeURIComponent(id)}`);

		eventSource.onmessage = (event) => {
			try {
				const payload = JSON.parse(event.data as string) as
					| { status: 'success'; ename: string }
					| { status: 'error'; message: string };

				if (payload.status === 'success') {
					void (async () => {
						try {
							const completeRes = await fetch('/api/auth/complete', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ sessionId: id })
							});
							if (!completeRes.ok) {
								const completeBody = await completeRes.json().catch(() => ({}));
								throw new Error(
									(completeBody as { error?: string }).error ||
										`Finalize login failed (${completeRes.status})`
								);
							}
							goto('/');
						} catch (completeError) {
							error =
								completeError instanceof Error
									? completeError.message
									: 'Failed to finalize login';
						}
					})();
					return;
				}

				if (payload.status === 'error') {
					error = payload.message || 'Authentication failed';
					cleanupSse();
				}
			} catch (parseError) {
				console.error('[auth] Failed parsing SSE message:', parseError);
			}
		};

		eventSource.onerror = () => {
			cleanupSse();
		};
	}

	async function fetchOfferAndWatch() {
		isLoading = true;
		error = null;
		cleanupSse();
		cleanupTimer();

		try {
			const response = await fetch('/api/auth/offer');
			if (!response.ok) {
				throw new Error(`Failed to fetch auth offer (${response.status})`);
			}

			const data = (await response.json()) as { uri: string; sessionId: string };
			offerUri = data.uri;
			sessionId = data.sessionId;
			qrDataUrl = await QRCode.toDataURL(offerUri, { width: 280, margin: 2 });

			setupSse(sessionId);
			refreshTimer = setTimeout(() => {
				void fetchOfferAndWatch();
			}, 60000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to initialize login';
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		detectMobile();
		window.addEventListener('resize', detectMobile);
		void fetchOfferAndWatch();
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', detectMobile);
		}
		cleanupSse();
		cleanupTimer();
	});
</script>

<div class="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center p-6">
	<div class="w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
		<h1 class="text-2xl font-semibold text-gray-900">Control Panel Login</h1>
		<p class="mt-2 text-sm text-gray-600">
			Authenticate with your eID Wallet. Only admin eNames in the server allowlist can access this
			panel.
		</p>

		{#if error}
			<div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
				{error}
			</div>
		{/if}

		<div class="mt-6 flex flex-col items-center gap-4 rounded-lg bg-gray-50 p-6">
			{#if isLoading}
				<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
				<p class="text-sm text-gray-600">Preparing authentication offer...</p>
			{:else if qrDataUrl}
				{#if isMobile}
					<a
						href={offerUri}
						class="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
					>
						Open eID Wallet
					</a>
					<p class="text-center text-sm text-gray-600">
						Tap to open the wallet app and complete authentication.
					</p>
				{:else}
					<img src={qrDataUrl} alt="W3DS auth QR code" class="h-64 w-64 rounded-lg bg-white p-2" />
					<p class="text-center text-sm text-gray-600">
						Scan this QR code with your eID Wallet app.
					</p>
				{/if}
			{/if}
		</div>

		<div class="mt-6 flex items-center justify-between">
			<p class="text-xs text-gray-500">Offer refreshes automatically every 60 seconds.</p>
			<button
				onclick={() => void fetchOfferAndWatch()}
				class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				Refresh Offer
			</button>
		</div>
	</div>
</div>
