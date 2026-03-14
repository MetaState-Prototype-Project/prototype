<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { PUBLIC_PICTIQUE_BASE_URL } from '$env/static/public';
	import { onMount } from 'svelte';

	const globalId = page.params.globalId as string;
	let error = $state('');
	let loading = $state(true);

	onMount(async () => {
		try {
			const response = await fetch(
				`${PUBLIC_PICTIQUE_BASE_URL}/api/resolve/${encodeURIComponent(globalId)}`
			);

			if (!response.ok) {
				error = 'Could not find this conversation.';
				loading = false;
				return;
			}

			const data = await response.json();
			if (data.localId) {
				const id = String(data.localId);
				await goto(`/messages/${encodeURIComponent(id)}`);
			} else {
				error = 'Could not find this conversation.';
				loading = false;
			}
		} catch (e) {
			console.error('Error resolving message:', e);
			error = 'Something went wrong. Please try again.';
			loading = false;
		}
	});
</script>

<div class="flex min-h-screen flex-col items-center justify-center p-6">
	{#if loading}
		<p class="text-gray-500">Opening conversation...</p>
	{:else if error}
		<p class="text-red-500">{error}</p>
		<a href="/home" class="mt-4 text-blue-500 underline">Go to Home</a>
	{/if}
</div>
