<script lang="ts">
	import { goto } from '$app/navigation';
	import { PUBLIC_PICTIQUE_BASE_URL } from '$env/static/public';
	import { W3dslogo } from '$lib/icons';
	import { Qr } from '$lib/ui';
	import { apiClient, setAuthId, setAuthToken } from '$lib/utils';
	import { onMount } from 'svelte';
	import { onDestroy } from 'svelte';
	import { qrcode } from 'svelte-qrcode-action';

	let qrData: string;
	let isMobile = false;

	function checkMobile() {
		isMobile = window.innerWidth <= 640; // Tailwind's `sm` breakpoint
	}

	onMount(async () => {
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
		{#if qrData}
			{#if isMobile}
				<h2 class="text-center">
					Click the button below to login using your <b><u>eID App</u></b>
				</h2>
				<a
					href={qrData}
					class="w-full rounded-lg bg-[#4D44EF] px-4 py-3 text-center font-semibold text-white transition hover:opacity-90"
				>
					Login with eID Wallet
				</a>
			{:else}
				<h2 class="text-center">
					Scan the QR code using your <b><u>eID App</u></b> to login
				</h2>
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
			<span class="mb-1 block font-bold text-gray-600">The code is valid for 60 seconds</span>
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

	<W3dslogo />
</div>
