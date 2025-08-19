<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		PUBLIC_APP_STORE_EID_WALLET,
		PUBLIC_PICTIQUE_BASE_URL,
		PUBLIC_PLAY_STORE_EID_WALLET
	} from '$env/static/public';
	import { W3dslogo } from '$lib/icons';
	import { Qr } from '$lib/ui';
	import { apiClient, setAuthId, setAuthToken } from '$lib/utils';
	import { getDeepLinkUrl, isMobileDevice } from '$lib/utils/mobile-detection';
	import { onMount } from 'svelte';
	import { onDestroy } from 'svelte';
	import { qrcode } from 'svelte-qrcode-action';

	let qrData: string;
	let isMobile = false;

	function checkMobile() {
		isMobile = window.innerWidth <= 640; // Tailwind's `sm` breakpoint
	}

	let getAppStoreLink: () => string = () => '';

	onMount(async () => {
		getAppStoreLink = () => {
			const userAgent = navigator.userAgent || navigator.vendor || window.opera;
			if (/android/i.test(userAgent)) {
				return 'https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet';
			}

			if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
				return 'https://apps.apple.com/in/app/eid-for-w3ds/id6747748667';
			}

			return 'https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet';
		};

		checkMobile();
		window.addEventListener('resize', checkMobile);

		const { data } = await apiClient.get('/api/auth/offer');
		qrData = data.uri;

		function watchEventStream(id: string) {
			const sseUrl = new URL(`/api/auth/sessions/${id}`, PUBLIC_PICTIQUE_BASE_URL).toString();
			const eventSource = new EventSource(sseUrl);

			eventSource.onopen = () => {
				console.log('Successfully connected.');
			};

			eventSource.onmessage = (e) => {
				const data = JSON.parse(e.data as string);
				const { user } = data;
				setAuthId(user.id);
				const { token } = data;
				setAuthToken(token);
				goto('/home');
			};
		}

		watchEventStream(new URL(qrData).searchParams.get('session') as string);

		onDestroy(() => {
			window.removeEventListener('resize', checkMobile);
		});
	});
</script>

<div class="flex h-full w-full flex-col items-center justify-center p-4">
	<div class="mb-5 flex flex-col items-center gap-2 text-center">
		<img src="/images/Logo.svg" alt="logo" class="w-30" />
		<p>Connect Socially in the Metastate</p>
	</div>

	<div
		class="mb-5 flex w-full max-w-[400px] flex-col items-center gap-5 rounded-xl bg-[#F476481A] p-5"
	>
		<h2>
			{#if isMobileDevice()}
				Login with your <a href={getAppStoreLink()}><b><u>eID Wallet</u></b></a>
			{:else}
				Scan the QR code using your <b><u>eID App</u></b> to login
			{/if}
		</h2>
		{#if qrData}
			{#if isMobileDevice()}
				<div class="flex flex-col items-center gap-4">
					<a
						href={getDeepLinkUrl(qrData)}
						class="rounded-xl bg-gradient-to-r from-[#4D44EF] via-[#F35B5B] to-[#F7A428] px-8 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90"
					>
						Login with eID Wallet
					</a>
					<div class="max-w-xs text-center text-sm text-gray-600">
						Click the button to open your eID wallet app
					</div>
				</div>
			{:else}
				<article
					class="overflow-hidden rounded-2xl"
					use:qrcode={{
						data: qrData,
						width: 250,
						height: 250,
						margin: 12,
						type: 'canvas',
						dotsOptions: {
							type: 'rounded',
							color: '#fff'
						},
						backgroundOptions: {
							gradient: {
								type: 'linear',
								rotation: 50,
								colorStops: [
									{ offset: 0, color: '#4D44EF' },
									{ offset: 0.65, color: '#F35B5B' },
									{ offset: 1, color: '#F7A428' }
								]
							}
						}
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

		<p class="w-full rounded-md bg-white/60 p-4 text-sm leading-4 text-black/60">
			You are entering Pictique - a social network built on the Web 3.0 Data Space (W3DS)
			architecture. This system is designed around the principle of data-platform separation,
			where all your personal content is stored in your own sovereign eVault, not on
			centralised servers.
		</p>
	</div>
	<a href="https://metastate.foundation" target="_blank">
		<W3dslogo />
	</a>
</div>
