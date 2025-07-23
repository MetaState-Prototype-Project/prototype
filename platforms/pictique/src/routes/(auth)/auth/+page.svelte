<script lang="ts">
	import { goto } from '$app/navigation';
	import { PUBLIC_PICTIQUE_BASE_URL } from '$env/static/public';
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
				const data = JSON.parse(e.data);
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
