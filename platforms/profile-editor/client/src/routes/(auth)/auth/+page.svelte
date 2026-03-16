<script lang="ts">
	import { PUBLIC_PROFILE_EDITOR_BASE_URL } from '$env/static/public';
	import { apiClient } from '$lib/utils/axios';
	import { login } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { qrcode } from 'svelte-qrcode-action';
	import { Button } from '@metastate-foundation/ui/button';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@metastate-foundation/ui/card';
	import { Skeleton } from '@metastate-foundation/ui/skeleton';
	import { Separator } from '@metastate-foundation/ui/separator';

	let qrData = $state<string>('');
	let errorMessage = $state<string | null>(null);

	function isMobileDevice(): boolean {
		return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent
		);
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
		signature: string
	) {
		try {
			const response = await fetch(`${PUBLIC_PROFILE_EDITOR_BASE_URL}/api/auth`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ename, session, signature })
			});

			if (response.ok) {
				const data = await response.json();
				if (data.token && data.user) {
					login(data.token, data.user);
					window.location.href = '/profile';
				}
			} else {
				const errorData = await response.json();
				errorMessage = errorData.message || 'Authentication failed. Please try again.';
			}
		} catch (error) {
			console.error('Login request failed:', error);
			errorMessage = 'Connection failed. Please try again.';
		}
	}

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		const ename = params.get('ename');
		const session = params.get('session');
		const signature = params.get('signature');

		if (ename && session && signature) {
			window.history.replaceState({}, '', window.location.pathname);
			await handleAutoLogin(ename, session, signature);
			return;
		}

		const { data } = await apiClient.get('/api/auth/offer');
		qrData = data.uri;

		function watchEventStream(id: string) {
			const sseUrl = new URL(
				`/api/auth/sessions/${id}`,
				PUBLIC_PROFILE_EDITOR_BASE_URL
			).toString();
			const eventSource = new EventSource(sseUrl);

			eventSource.onopen = () => {
				errorMessage = null;
			};

			eventSource.onmessage = async (e) => {
				const data = JSON.parse(e.data as string);

				if (data.error) {
					errorMessage = data.message || 'Authentication error';
					eventSource.close();
					return;
				}

				if (data.user && data.token) {
					login(data.token, data.user);
					eventSource.close();
					window.location.href = '/profile';
				}
			};

			eventSource.onerror = () => {
				eventSource.close();
			};
		}

		watchEventStream(new URL(qrData).searchParams.get('session') as string);
	});
</script>

<div class="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
	<div class="mb-8 flex flex-col items-center gap-3 text-center">
		<div class="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
			<svg class="h-8 w-8 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
			</svg>
		</div>
		<h1 class="text-3xl font-bold text-foreground">Profile Editor</h1>
		<p class="text-muted-foreground">Build your professional profile on the W3DS ecosystem</p>
	</div>

	<Card class="w-full max-w-[400px]">
		<CardHeader class="items-center text-center">
			<CardTitle>
				{#if isMobileDevice()}
					Login with your <a href={getAppStoreLink()} class="font-bold underline">eID Wallet</a>
				{:else}
					Scan with your <span class="font-bold">eID Wallet</span>
				{/if}
			</CardTitle>
			<CardDescription>Use your eID Wallet to authenticate</CardDescription>
		</CardHeader>

		<CardContent class="flex flex-col items-center gap-5">
			{#if errorMessage}
				<div class="w-full rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
					<p class="font-semibold">Authentication Error</p>
					<p>{errorMessage}</p>
				</div>
			{/if}

			{#if qrData}
				{#if isMobileDevice()}
					<div class="flex flex-col items-center gap-4">
						<Button href={qrData} size="lg">Login with eID Wallet</Button>
						<p class="max-w-xs text-center text-sm text-muted-foreground">
							Tap the button to open your eID Wallet app
						</p>
					</div>
				{:else}
					<article
						class="overflow-hidden rounded-2xl bg-background p-4"
						use:qrcode={{
							data: qrData,
							width: 250,
							height: 250,
							margin: 12,
							type: 'canvas'
						}}
					></article>
				{/if}
			{:else}
				<div class="flex h-[250px] w-[250px] items-center justify-center">
					<Skeleton class="h-[250px] w-[250px] rounded-2xl" />
				</div>
			{/if}

			<Separator />

			<p class="text-center text-xs text-muted-foreground">
				<span class="mb-1 block font-medium">
					The {isMobileDevice() ? 'button' : 'code'} is valid for 60 seconds
				</span>
				<span class="block">Please refresh the page if it expires</span>
			</p>
		</CardContent>
	</Card>
</div>
