<script lang="ts">
	import { goto } from '$app/navigation';
	import { PUBLIC_PICTIQUE_BASE_URL } from '$env/static/public';
	import { W3dslogo } from '$lib/icons';
	import { Qr } from '$lib/ui';
	import { apiClient, setAuthId, setAuthToken } from '$lib/utils';
	import { onMount } from 'svelte';
	import { qrcode } from 'svelte-qrcode-action';

	let qrData: string;

	onMount(async () => {
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
	});
</script>

<div
	class="align-center flex h-full w-full flex-col content-center items-center
    justify-center"
>
	<div class="mb-5 flex flex-col items-center gap-2">
		<img src="/images/Logo.svg" alt="logo" class="w-30" />
		<p>Connect Socially in the Metastate</p>
	</div>
	<div
		class="h-max-[600px] w-max-[400px] mb-5 flex flex-col items-center gap-5 rounded-xl bg-[#F476481A] p-5"
	>
		<h2>Scan the QR code using your <b><u>eID App</u></b> to login</h2>
    {#if qrData}
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
		<a href={qrData}>{qrData}</a>
    {/if}
		<p>
			<span class="mb-1 block font-bold text-gray-600">The code is valid for 60 seconds</span>
			<span class="block font-light text-gray-600">Please refresh the page if it expires</span
			>
		</p>
		<p class="w-[350px] bg-white/60 p-4 leading-4 text-black/60">
			You are entering Pictique - a social network built on the Web 3.0 Data Space (W3DS)
			architecture. This system is designed around the principle of data-platform separation,
			where all your personal content is stored in your own sovereign eVault, not on
			centralised servers.
		</p>
	</div>
	<W3dslogo />
</div>
