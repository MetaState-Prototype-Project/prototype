<script lang="ts">
	import { goto } from '$app/navigation';
	import { PUBLIC_PICTIQUE_BASE_URL } from '$env/static/public';
	import { Qr } from '$lib/ui';
	import { apiClient, setAuthId, setAuthToken } from '$lib/utils';
	import { onMount } from 'svelte';

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
	<div
		class="h-max-[600px] bg-grey flex w-[300px] flex-col items-center gap-5
        rounded-md p-5"
	>
		<img src="/images/Logo.svg" alt="logo" />

		<Qr data={qrData}></Qr>

		<h1>Scan the QR to Login</h1>
	</div>
</div>
